import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async sendMessage(senderId: string, data: { receiverId: string; content: string }) {
    const receiver = await this.prisma.user.findUnique({
      where: { id: data.receiverId },
    });
    if (!receiver) throw new NotFoundException('Recipient not found');

    return this.prisma.message.create({
      data: { senderId, receiverId: data.receiverId, content: data.content },
      include: {
        sender: { select: { id: true, name: true, role: true } },
        receiver: { select: { id: true, name: true, role: true } },
      },
    });
  }

  async getConversation(userId: string, otherUserId: string) {
    return this.prisma.message.findMany({
      where: {
        OR: [
          { senderId: userId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: userId },
        ],
      },
      orderBy: { createdAt: 'asc' },
      include: {
        sender: { select: { id: true, name: true, role: true } },
      },
    });
  }

  async getInbox(userId: string) {
    const messages = await this.prisma.message.findMany({
      where: { receiverId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        sender: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    const grouped = new Map<string, typeof messages>();
    for (const msg of messages) {
      if (!grouped.has(msg.senderId)) {
        grouped.set(msg.senderId, []);
      }
      grouped.get(msg.senderId)!.push(msg);
    }

    return Array.from(grouped.entries()).map(([senderId, msgs]) => ({
      senderId,
      senderName: msgs[0].sender.name,
      senderRole: msgs[0].sender.role,
      unreadCount: msgs.filter((m) => !m.read).length,
      lastMessage: msgs[0],
    }));
  }

  async markRead(userId: string, senderId: string) {
    await this.prisma.message.updateMany({
      where: { receiverId: userId, senderId, read: false },
      data: { read: true },
    });
    return { success: true };
  }

  async getUnreadCount(userId: string) {
    const count = await this.prisma.message.count({
      where: { receiverId: userId, read: false },
    });
    return { unreadCount: count };
  }
}
