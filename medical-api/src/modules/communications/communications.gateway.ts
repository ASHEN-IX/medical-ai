import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MessagesService } from '../messages/messages.service';

@WebSocketGateway({
  cors: {
    origin: '*', // In production, restrict this to your frontend URL
  },
})
export class CommunicationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(CommunicationsGateway.name);

  // Map of userId -> socketId to target specific users
  private userSockets = new Map<string, string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly messagesService: MessagesService,
  ) {}

  async handleConnection(client: Socket) {
    const userId = client.handshake.query.userId as string;
    if (userId) {
      this.userSockets.set(userId, client.id);
      this.logger.log(`User connected: ${userId} (Socket: ${client.id})`);
    }
  }

  handleDisconnect(client: Socket) {
    for (const [userId, socketId] of this.userSockets.entries()) {
      if (socketId === client.id) {
        this.userSockets.delete(userId);
        this.logger.log(`User disconnected: ${userId}`);
        break;
      }
    }
  }

  emitAlert(userId: string, alert: any) {
    const socketId = this.userSockets.get(userId);
    if (socketId) {
      this.server.to(socketId).emit('newAlert', alert);
    }
  }

  // --- Chat Handlers ---

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; content: string; receiverId: string },
  ) {
    const senderId = client.handshake.query.userId as string;
    if (!senderId) return;

    // Save message via service
    const message = await this.messagesService.sendMessage(senderId, {
      conversationId: data.conversationId,
      content: data.content,
      receiverId: data.receiverId,
    });

    // Notify receiver if online
    const receiverSocketId = this.userSockets.get(data.receiverId);
    if (receiverSocketId) {
      this.server.to(receiverSocketId).emit('newMessage', message);
    }

    return message;
  }

  // --- Teleconsultation Signaling Handlers ---

  @SubscribeMessage('joinRoom')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    client.join(data.roomId);
    this.logger.log(`Client ${client.id} joined room: ${data.roomId}`);
    client.to(data.roomId).emit('userJoined', { socketId: client.id });
  }

  @SubscribeMessage('leaveRoom')
  handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    client.leave(data.roomId);
    client.to(data.roomId).emit('userLeft', { socketId: client.id });
  }

  @SubscribeMessage('offer')
  handleOffer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; offer: any },
  ) {
    client.to(data.roomId).emit('offer', {
      offer: data.offer,
      from: client.id,
    });
  }

  @SubscribeMessage('answer')
  handleAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; answer: any },
  ) {
    client.to(data.roomId).emit('answer', {
      answer: data.answer,
      from: client.id,
    });
  }

  @SubscribeMessage('iceCandidate')
  handleIceCandidate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; candidate: any },
  ) {
    client.to(data.roomId).emit('iceCandidate', {
      candidate: data.candidate,
      from: client.id,
    });
  }
}
