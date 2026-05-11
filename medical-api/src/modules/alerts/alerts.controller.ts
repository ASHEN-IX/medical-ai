import {
  Controller, Post, Get, Patch, Param, Body, Query, UseGuards, Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AlertsService } from './alerts.service';

@ApiTags('alerts')
@Controller('alerts')
@ApiBearerAuth('JWT')
@UseGuards(AuthGuard('jwt'))
export class AlertsController {
  constructor(private readonly service: AlertsService) {}

  @Get()
  @ApiOperation({ summary: 'Get my alerts' })
  async getAlerts(@Request() req: any, @Query('unreadOnly') unreadOnly?: string) {
    return this.service.getUserAlerts(req.user.id, unreadOnly === 'true');
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread alert count' })
  async getUnreadCount(@Request() req: any) {
    return this.service.getUnreadCount(req.user.id);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark alert as read' })
  async markRead(@Param('id') id: string) {
    return this.service.markRead(id);
  }

  @Patch(':id/dismiss')
  @ApiOperation({ summary: 'Dismiss alert' })
  async dismiss(@Param('id') id: string) {
    return this.service.dismiss(id);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all alerts as read' })
  async markAllRead(@Request() req: any) {
    return this.service.markAllRead(req.user.id);
  }
}
