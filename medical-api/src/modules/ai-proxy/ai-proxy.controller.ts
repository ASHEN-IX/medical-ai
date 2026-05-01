import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AiProxyService, AiAnalyzePayload, AiChatPayload } from './ai-proxy.service';

@ApiTags('ai')
@Controller('ai')
@ApiBearerAuth('JWT')
@UseGuards(AuthGuard('jwt'))
export class AiProxyController {
  constructor(private readonly aiProxyService: AiProxyService) {}

  @Post('analyze')
  @ApiOperation({ summary: 'Run AI analysis on medical data (proxied through backend)' })
  async analyze(@Request() req: any, @Body() payload: AiAnalyzePayload) {
    return this.aiProxyService.analyze(req.user.id, payload);
  }

  @Post('chat')
  @ApiOperation({ summary: 'AI chat assistant for patients' })
  async chat(@Body() payload: AiChatPayload) {
    return this.aiProxyService.chat(payload);
  }

  @Get('health-timeline')
  @ApiOperation({ summary: 'Get health metrics timeline for current user' })
  async getHealthTimeline(@Request() req: any) {
    return this.aiProxyService.getHealthTimeline(req.user.id);
  }
}
