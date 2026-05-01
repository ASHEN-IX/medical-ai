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
  @ApiOperation({ summary: 'Send a message to another user' })
  async sendMessage(
    @Request() req: any,
    @Body() body: { receiverId: string; content: string },
  ) {
    return this.service.sendMessage(req.user.id, body);
  }

  @Get('inbox')
  @ApiOperation({ summary: 'Get message inbox grouped by sender' })
  async getInbox(@Request() req: any) {
    return this.service.getInbox(req.user.id);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread message count' })
  async getUnreadCount(@Request() req: any) {
    return this.service.getUnreadCount(req.user.id);
  }

  @Get('conversation/:userId')
  @ApiOperation({ summary: 'Get conversation with a specific user' })
  async getConversation(@Param('userId') userId: string, @Request() req: any) {
    return this.service.getConversation(req.user.id, userId);
  }

  @Patch('read/:senderId')
  @ApiOperation({ summary: 'Mark messages from a sender as read' })
  async markRead(@Param('senderId') senderId: string, @Request() req: any) {
    return this.service.markRead(req.user.id, senderId);
  }
}
