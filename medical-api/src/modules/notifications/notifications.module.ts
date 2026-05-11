import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsService } from './notifications.service';
import { AlertsModule } from '../alerts/alerts.module';

@Module({
  imports: [PrismaModule, AlertsModule],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
