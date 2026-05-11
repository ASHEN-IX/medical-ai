import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ConsultationHistoryService } from './consultation-history.service';

@ApiTags('consultation-history')
@Controller('consultation-history')
@ApiBearerAuth('JWT')
@UseGuards(AuthGuard('jwt'))
export class ConsultationHistoryController {
  constructor(private readonly service: ConsultationHistoryService) {}

  @Get('timeline')
  @ApiOperation({ summary: 'Get unified consultation timeline' })
  async getTimeline(@Request() req: any) {
    return this.service.getUnifiedTimeline(req.user.id);
  }

  @Get('events')
  @ApiOperation({ summary: 'Get history events with optional filter' })
  async getEvents(
    @Request() req: any,
    @Query('eventType') eventType?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getTimeline(req.user.id, {
      eventType,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }
}
