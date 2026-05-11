import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRole } from '@prisma/client';
import { ForbiddenException } from '@nestjs/common';

@ApiTags('monitoring')
@Controller()
@ApiBearerAuth('JWT')
@UseGuards(AuthGuard('jwt'))
export class MonitoringController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('logs/audit-feed')
  @ApiOperation({ summary: 'Get live HIPAA audit feed (Admins only)' })
  async getAuditFeed(@Request() req: any) {
    if (req.user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can access the audit feed');
    }

    return this.prisma.auditLog.findMany({
      take: 50,
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get('metrics/mlops-summary')
  @ApiOperation({ summary: 'Get MLOps performance summary (Admins only)' })
  async getMlOpsSummary(@Request() req: any) {
    if (req.user.role !== UserRole.ADMIN && req.user.role !== UserRole.DOCTOR) {
      throw new ForbiddenException('Insufficient permissions');
    }

    const recentPredictions = await this.prisma.predictionLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    const volume = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const dayKey = d.toISOString().slice(0, 10);
      return {
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        count: recentPredictions.filter((prediction) => prediction.createdAt.toISOString().slice(0, 10) === dayKey).length,
      };
    });

    const driftByModel = recentPredictions.reduce<Record<string, { drifted: number; total: number }>>((acc, prediction) => {
      const current = acc[prediction.modelId] || { drifted: 0, total: 0 };
      current.total += 1;
      if (prediction.driftDetected) current.drifted += 1;
      acc[prediction.modelId] = current;
      return acc;
    }, {});

    const drift = Object.fromEntries(
      Object.entries(driftByModel).map(([modelId, stats]) => [
        modelId,
        stats.total ? Number((stats.drifted / stats.total).toFixed(3)) : 0,
      ]),
    );

    const latency = recentPredictions.length
      ? Math.round(
          recentPredictions.reduce((sum, prediction) => sum + prediction.processingTimeMs, 0) /
            recentPredictions.length,
        )
      : 0;

    return {
      latency,
      drift,
      volume,
      totalPredictions: recentPredictions.length,
      driftAlerts: recentPredictions.filter((prediction) => prediction.driftDetected).length,
    };
  }
}
