import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ManualTestsController } from './manual-tests.controller';
import { ManualTestsService } from './manual-tests.service';
import { AnalysesModule } from '../analyses/analyses.module';
import { CaseAssignmentsModule } from '../case-assignments/case-assignments.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, AnalysesModule, CaseAssignmentsModule, NotificationsModule],
  controllers: [ManualTestsController],
  providers: [ManualTestsService],
  exports: [ManualTestsService],
})
export class ManualTestsModule {}
