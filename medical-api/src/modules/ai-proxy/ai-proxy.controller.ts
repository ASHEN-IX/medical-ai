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
import {
  AiProxyService,
  AiAnalyzePayload,
  AiChatPayload,
  StagedAnalyzePayload,
  SubmitAnswersPayload,
  FinalReportPayload,
  FetchQuestionsPayload,
} from './ai-proxy.service';
import { AuditLog } from '../../common/decorators/audit-log.decorator';

@ApiTags('ai')
@Controller('ai')
@ApiBearerAuth('JWT')
@UseGuards(AuthGuard('jwt'))
export class AiProxyController {
  constructor(private readonly aiProxyService: AiProxyService) {}

  @Post('analyze')
  @ApiOperation({ summary: 'Run AI analysis on medical data (proxied through backend)' })
  @AuditLog({ resource: 'Analysis', action: 'CREATE' })
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

  @Post('diagnosis/analyze')
  @ApiOperation({ summary: 'Start staged diagnosis with initial analysis + follow-up questions' })
  @AuditLog({ resource: 'StagedDiagnosis', action: 'CREATE' })
  async stagedAnalyze(@Request() req: any, @Body() payload: StagedAnalyzePayload) {
    return this.aiProxyService.stagedAnalyze(req.user.id, payload);
  }

  @Post('diagnosis/questions')
  @ApiOperation({ summary: 'Fetch follow-up questions for a diagnosis session' })
  async fetchQuestions(@Body() payload: FetchQuestionsPayload) {
    return this.aiProxyService.fetchQuestions(payload);
  }

  @Post('diagnosis/answers')
  @ApiOperation({ summary: 'Submit patient answers to follow-up questions' })
  async submitAnswers(@Body() payload: SubmitAnswersPayload) {
    return this.aiProxyService.submitAnswers(payload);
  }

  @Post('diagnosis/final-report')
  @ApiOperation({ summary: 'Generate final enriched diagnosis report' })
  @AuditLog({ resource: 'StagedDiagnosis', action: 'FINALIZE' })
  async finalReport(@Request() req: any, @Body() payload: FinalReportPayload) {
    return this.aiProxyService.generateFinalReport(req.user.id, payload);
  }
}
