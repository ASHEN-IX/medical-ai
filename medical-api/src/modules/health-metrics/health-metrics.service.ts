import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

export interface HealthMetricInput {
  metricKey: string;
  value: number;
  unit?: string;
  source?: string; // 'manual', 'apple_health', 'google_fit', 'wearable'
}

interface MetricThreshold {
  min: number;
  max: number;
  criticalMin?: number;
  criticalMax?: number;
}

/**
 * Normal health metric thresholds for adults
 * Used for alert generation
 */
const METRIC_THRESHOLDS: Record<string, MetricThreshold> = {
  blood_pressure: { min: 90, max: 140, criticalMin: 60, criticalMax: 180 },
  heart_rate: { min: 60, max: 100, criticalMin: 40, criticalMax: 150 },
  oxygen_saturation: { min: 95, max: 100, criticalMin: 85, criticalMax: 100 },
  temperature: { min: 36.5, max: 37.5, criticalMin: 35, criticalMax: 39 },
  glucose: { min: 70, max: 140, criticalMin: 40, criticalMax: 400 },
  weight: { min: 40, max: 200 }, // Very wide range, individual variations
  bmi: { min: 18.5, max: 25, criticalMin: 15, criticalMax: 40 },
  cholesterol: { min: 0, max: 200, criticalMin: 0, criticalMax: 300 },
  blood_urea: { min: 7, max: 20, criticalMin: 0, criticalMax: 50 },
  serum_creatinine: { min: 0.7, max: 1.3, criticalMin: 0, criticalMax: 5 },
};

/**
 * HealthMetricsService
 * Tracks patient vital signs and health metrics
 * Generates alerts for abnormal values
 */
@Injectable()
export class HealthMetricsService {
  private readonly logger = new Logger(HealthMetricsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Ingest a health metric for a patient
   */
  async ingestMetric(userId: string, metric: HealthMetricInput): Promise<any> {
    // Validate user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('Patient not found');
    }

    // Validate metric key
    if (!metric.metricKey) {
      throw new BadRequestException('Metric key is required');
    }

    // Store metric
    const storedMetric = await this.prisma.healthMetric.create({
      data: {
        userId,
        metricKey: metric.metricKey.toLowerCase(),
        value: metric.value,
        unit: metric.unit || this.getDefaultUnit(metric.metricKey),
        source: metric.source || 'manual',
      },
    });

    // Check for alerts
    await this.checkAndAlertAbnormalValues(userId, user.name, metric);

    // Record history event
    await this.notifications.recordHistoryEvent(
      userId,
      'HEALTH_METRIC',
      `${metric.metricKey}: ${metric.value}${metric.unit || ''}`,
      `Health metric recorded: ${metric.metricKey}`,
    );

    this.logger.debug(`Metric ingested: ${metric.metricKey} = ${metric.value} for user ${userId}`);

    return storedMetric;
  }

  /**
   * Ingest multiple metrics at once
   */
  async ingestMultipleMetrics(userId: string, metrics: HealthMetricInput[]): Promise<any[]> {
    const results = [];
    for (const metric of metrics) {
      try {
        const result = await this.ingestMetric(userId, metric);
        results.push(result);
      } catch (err: any) {
        this.logger.warn(`Failed to ingest metric ${metric.metricKey}: ${err.message}`);
      }
    }
    return results;
  }

  /**
   * Get patient's recent metrics
   */
  async getRecentMetrics(userId: string, limit: number = 50): Promise<any[]> {
    return this.prisma.healthMetric.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get latest value for a specific metric
   */
  async getLatestMetric(userId: string, metricKey: string): Promise<any | null> {
    return this.prisma.healthMetric.findFirst({
      where: {
        userId,
        metricKey: metricKey.toLowerCase(),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get metric trends (last N readings)
   */
  async getMetricTrend(userId: string, metricKey: string, limit: number = 30): Promise<any[]> {
    return this.prisma.healthMetric.findMany({
      where: {
        userId,
        metricKey: metricKey.toLowerCase(),
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  /**
   * Get patient's latest values for all tracked metrics
   */
  async getLatestMetrics(userId: string): Promise<Record<string, any>> {
    const metrics = await this.prisma.healthMetric.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      distinct: ['metricKey'],
    });

    const result: Record<string, any> = {};
    for (const metric of metrics) {
      result[metric.metricKey] = {
        value: metric.value,
        unit: metric.unit,
        source: metric.source,
        createdAt: metric.createdAt,
      };
    }
    return result;
  }

  /**
   * Check for abnormal values and trigger alerts
   */
  private async checkAndAlertAbnormalValues(
    userId: string,
    userName: string,
    metric: HealthMetricInput,
  ): Promise<void> {
    const thresholds = METRIC_THRESHOLDS[metric.metricKey.toLowerCase()];
    if (!thresholds) return; // No thresholds defined for this metric

    const { value } = metric;
    const { min, max, criticalMin, criticalMax } = thresholds;

    // Check for critical values
    if (
      (criticalMin !== undefined && value < criticalMin) ||
      (criticalMax !== undefined && value > criticalMax)
    ) {
      await this.notifications.notify({
        userId,
        type: 'CRITICAL_RISK',
        severity: 'EMERGENCY',
        title: `Critical ${metric.metricKey} Alert`,
        message: `Your ${metric.metricKey} is dangerously ${value < min ? 'low' : 'high'}: ${value}${metric.unit || ''}. Seek immediate medical attention.`,
        channels: ['in_app', 'sms', 'email'],
        data: { metric: metric.metricKey, value, thresholds },
      });

      return;
    }

    // Check for warning values
    if (value < min || value > max) {
      await this.notifications.notify({
        userId,
        type: 'TREND_WARNING',
        severity: 'WARNING',
        title: `${metric.metricKey} Out of Range`,
        message: `Your ${metric.metricKey} is outside normal range: ${value}${metric.unit || ''} (normal: ${min}-${max}).`,
        channels: ['in_app', 'email'],
        data: { metric: metric.metricKey, value, thresholds },
      });
    }
  }

  /**
   * Analyze trends and detect significant changes
   */
  async analyzeTrends(userId: string, metricKey: string): Promise<{
    trend: 'increasing' | 'decreasing' | 'stable';
    changePercent: number;
    isSignificant: boolean;
  }> {
    const trend = await this.getMetricTrend(userId, metricKey, 10);

    if (trend.length < 2) {
      return { trend: 'stable', changePercent: 0, isSignificant: false };
    }

    const oldest = trend[0];
    const newest = trend[trend.length - 1];
    const change = newest.value - oldest.value;
    const changePercent = (change / oldest.value) * 100;
    const isSignificant = Math.abs(changePercent) > 10; // 10% change is significant

    const trendDirection: 'increasing' | 'decreasing' | 'stable' =
      Math.abs(changePercent) < 5
        ? 'stable'
        : changePercent > 0
          ? 'increasing'
          : 'decreasing';

    return { trend: trendDirection, changePercent, isSignificant };
  }

  /**
   * Get default unit for a metric
   */
  private getDefaultUnit(metricKey: string): string {
    const unitMap: Record<string, string> = {
      blood_pressure: 'mmHg',
      heart_rate: 'bpm',
      oxygen_saturation: '%',
      temperature: '°C',
      glucose: 'mg/dL',
      weight: 'kg',
      bmi: 'kg/m²',
      cholesterol: 'mg/dL',
      blood_urea: 'mg/dL',
      serum_creatinine: 'mg/dL',
    };
    return unitMap[metricKey.toLowerCase()] || '';
  }

  /**
   * Generate health report for patient (aggregated metrics)
   */
  async generateHealthReport(userId: string, days: number = 30): Promise<any> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const metrics = await this.prisma.healthMetric.findMany({
      where: {
        userId,
        createdAt: { gte: startDate },
      },
    });

    const report: Record<string, any> = {
      userId,
      period: `Last ${days} days`,
      startDate,
      endDate: new Date(),
      metrics: {},
    };

    // Group by metric key and calculate stats
    const groupedMetrics: Record<string, number[]> = {};
    for (const metric of metrics) {
      if (!groupedMetrics[metric.metricKey]) {
        groupedMetrics[metric.metricKey] = [];
      }
      groupedMetrics[metric.metricKey].push(metric.value);
    }

    // Calculate stats for each metric
    for (const [key, values] of Object.entries(groupedMetrics)) {
      const sorted = [...values].sort((a, b) => a - b);
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      const min = sorted[0];
      const max = sorted[sorted.length - 1];
      const median = sorted[Math.floor(sorted.length / 2)];

      report.metrics[key] = {
        count: values.length,
        avg: parseFloat(avg.toFixed(2)),
        min,
        max,
        median,
        latest: values[values.length - 1],
      };
    }

    return report;
  }
}
