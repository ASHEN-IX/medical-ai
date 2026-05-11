import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MessagesService } from './messages.service';

@ApiTags('messages')
@Controller('messages')
@ApiBearerAuth('JWT')
@UseGuards(AuthGuard('jwt'))
export class MessagesController {
  constructor(private readonly service: MessagesService) {}

  @Post()
  @ApiOperation({ summary: 'Send a message (to conversation or user)' })
  async sendMessage(
    @Request() req: any,
    @Body() body: { conversationId?: string; receiverId?: string; content: string; type?: string; fileUrl?: string },
  ) {
    return this.service.sendMessage(req.user.id, body);
  }

  @Get('conversations')
  @ApiOperation({ summary: 'Get all user conversations' })
  async getConversations(@Request() req: any) {
    return this.service.getUserConversations(req.user.id);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get total unread message count' })
  async getUnreadCount(@Request() req: any) {
    return this.service.getUnreadCount(req.user.id);
  }

  @Get('conversation/:id/messages')
  @ApiOperation({ summary: 'Get messages in a conversation' })
  async getConversationMessages(@Param('id') id: string) {
    return this.service.getMessagesByConversation(id);
  }

  @Patch('conversation/:id/read')
  @ApiOperation({ summary: 'Mark conversation as read' })
  async markRead(@Param('id') id: string, @Request() req: any) {
    return this.service.markConversationRead(req.user.id, id);
  }
}
