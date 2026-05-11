import { Controller, Post, Get, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { HealthMetricsService } from './health-metrics.service';
import { IngestMetricDto } from './dto/ingest-metric.dto';

@ApiTags('health-metrics')
@Controller('health-metrics')
@ApiBearerAuth('JWT')
@UseGuards(AuthGuard('jwt'))
export class HealthMetricsController {
  constructor(private readonly service: HealthMetricsService) {}

  @Post('ingest')
  @ApiOperation({ summary: 'Record a single health metric' })
  async ingestMetric(@Request() req: any, @Body() dto: IngestMetricDto) {
    return this.service.ingestMetric(req.user.id, dto);
  }

  @Post('ingest-batch')
  @ApiOperation({ summary: 'Record multiple health metrics at once' })
  async ingestMultiple(@Request() req: any, @Body() body: { metrics: IngestMetricDto[] }) {
    return this.service.ingestMultipleMetrics(req.user.id, body.metrics);
  }

  @Get('recent')
  @ApiOperation({ summary: 'Get recent health metrics' })
  async getRecent(@Request() req: any, @Query('limit') limit?: number) {
    return this.service.getRecentMetrics(req.user.id, limit || 50);
  }

  @Get('latest')
  @ApiOperation({ summary: 'Get latest value for all metrics' })
  async getLatest(@Request() req: any) {
    return this.service.getLatestMetrics(req.user.id);
  }

  @Get('latest/:metricKey')
  @ApiOperation({ summary: 'Get latest value for specific metric' })
  async getLatestMetric(@Request() req: any, @Param('metricKey') metricKey: string) {
    return this.service.getLatestMetric(req.user.id, metricKey);
  }

  @Get('trend/:metricKey')
  @ApiOperation({ summary: 'Get metric trend (last 30 readings)' })
  async getTrend(@Request() req: any, @Param('metricKey') metricKey: string) {
    return this.service.getMetricTrend(req.user.id, metricKey);
  }

  @Get('analyze/:metricKey')
  @ApiOperation({ summary: 'Analyze trend for metric' })
  async analyzeTrend(@Request() req: any, @Param('metricKey') metricKey: string) {
    return this.service.analyzeTrends(req.user.id, metricKey);
  }

  @Get('report')
  @ApiOperation({ summary: 'Generate health report for last 30 days' })
  async getReport(@Request() req: any) {
    return this.service.generateHealthReport(req.user.id, 30);
  }
}
