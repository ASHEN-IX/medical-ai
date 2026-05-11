import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AlertsModule } from '../alerts/alerts.module';
import { PrescriptionsService } from './prescriptions.service';
import { PrescriptionsController } from './prescriptions.controller';

@Module({
  imports: [PrismaModule, AlertsModule],
  providers: [PrescriptionsService],
  controllers: [PrescriptionsController],
  exports: [PrescriptionsService],
})
export class PrescriptionsModule {}
