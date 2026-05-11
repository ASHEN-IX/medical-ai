import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AiProxyService } from './ai-proxy.service';
import { AiProxyController } from './ai-proxy.controller';

import { CaseAssignmentsModule } from '../case-assignments/case-assignments.module';
import { AlertsModule } from '../alerts/alerts.module';

@Module({
  imports: [PrismaModule, CaseAssignmentsModule, AlertsModule],
  providers: [AiProxyService],
  controllers: [AiProxyController],
  exports: [AiProxyService],
})
export class AiProxyModule {}
