import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { FamilyConsentModule } from '../family-consent/family-consent.module';

@Module({
  imports: [PrismaModule, FamilyConsentModule],
  providers: [ReportsService],
  controllers: [ReportsController],
  exports: [ReportsService],
})
export class ReportsModule {}
