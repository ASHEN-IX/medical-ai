import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { HealthMetricsController } from './health-metrics.controller';
import { HealthMetricsService } from './health-metrics.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [HealthMetricsController],
  providers: [HealthMetricsService],
  exports: [HealthMetricsService],
})
export class HealthMetricsModule {}
