import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AlertsModule } from '../alerts/alerts.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CaseAssignmentsController } from './case-assignments.controller';
import { CaseAssignmentsService } from './case-assignments.service';

@Module({
  imports: [PrismaModule, AlertsModule, NotificationsModule],
  controllers: [CaseAssignmentsController],
  providers: [CaseAssignmentsService],
  exports: [CaseAssignmentsService],
})
export class CaseAssignmentsModule {}
