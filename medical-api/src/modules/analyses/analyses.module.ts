import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AnalysesService } from './analyses.service';
import { AnalysesController } from './analyses.controller';
import { CaseAssignmentsModule } from '../case-assignments/case-assignments.module';
import { AlertsModule } from '../alerts/alerts.module';
import { FamilyConsentModule } from '../family-consent/family-consent.module';

@Module({
  imports: [PrismaModule, CaseAssignmentsModule, AlertsModule, FamilyConsentModule],
  providers: [AnalysesService],
  controllers: [AnalysesController],
  exports: [AnalysesService],
})
export class AnalysesModule {}
