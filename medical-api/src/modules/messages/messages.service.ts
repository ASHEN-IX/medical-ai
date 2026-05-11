import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Get or create a direct conversation between two users */
  async getOrCreateConversation(userIds: string[], title?: string) {
    // For direct chat, check if conversation exists with exactly these participants
    if (userIds.length === 2) {
      const existing = await this.prisma.conversation.findFirst({
        where: {
          type: 'DIRECT',
          AND: [
            { participants: { some: { userId: userIds[0] } } },
            { participants: { some: { userId: userIds[1] } } },
          ],
        },
        include: { participants: { include: { user: { select: { id: true, name: true, role: true } } } } },
      });
      if (existing) return existing;
    }

    return this.prisma.conversation.create({
      data: {
        title,
        type: userIds.length > 2 ? 'GROUP' : 'DIRECT',
        participants: {
          create: userIds.map((id) => ({ userId: id })),
        },
      },
      include: { participants: { include: { user: { select: { id: true, name: true, role: true } } } } },
    });
  }

  async sendMessage(senderId: string, data: { conversationId?: string; receiverId?: string; content: string; type?: string; fileUrl?: string }) {
    let conversationId = data.conversationId;

    if (!conversationId && data.receiverId) {
      const conv = await this.getOrCreateConversation([senderId, data.receiverId]);
      conversationId = conv.id;
    }

    if (!conversationId) throw new NotFoundException('Conversation not found');

    // Ensure receiverId is set (Prisma Message requires receiverId)
    let receiverId = data.receiverId;
    if (!receiverId) {
      const conv = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { participants: { include: { user: { select: { id: true } } } } },
      });
      if (conv) {
        const other = conv.participants.find((p: any) => p.userId !== senderId);
        receiverId = other?.userId;
      }
    }

    return this.prisma.message.create({
      data: {
        senderId,
        receiverId: receiverId || '',
        conversationId,
        content: data.content,
        messageType: (data.type as any) || 'TEXT',
        fileUrl: data.fileUrl,
      },
      include: {
        sender: { select: { id: true, name: true, role: true } },
      },
    });
  }

  async getMessagesByConversation(conversationId: string, limit = 50) {
    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: limit,
      include: {
        sender: { select: { id: true, name: true, role: true } },
      },
    });
  }

  async getUserConversations(userId: string) {
    const participants = await this.prisma.conversationParticipant.findMany({
      where: { userId },
      include: {
        conversation: {
          include: {
            participants: {
              where: { NOT: { userId } },
              include: { user: { select: { id: true, name: true, role: true } } },
            },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    return participants.map((p: any) => ({
      ...p.conversation,
      unreadCount: 0, // Logic for unread count per conversation can be added later
      lastMessage: p.conversation.messages[0] || null,
      otherParticipant: p.conversation.participants[0]?.user || null,
    })).sort((a: any, b: any) => {
      const aTime = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
      const bTime = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
      return bTime - aTime;
    });
  }

  async markConversationRead(userId: string, conversationId: string) {
    await this.prisma.message.updateMany({
      where: { conversationId, NOT: { senderId: userId }, read: false },
      data: { read: true },
    });
    return { success: true };
  }

  async getUnreadCount(userId: string) {
    const count = await this.prisma.message.count({
      where: {
        conversation: { participants: { some: { userId } } },
        NOT: { senderId: userId },
        read: false,
      },
    });
    return { unreadCount: count };
  }
}
