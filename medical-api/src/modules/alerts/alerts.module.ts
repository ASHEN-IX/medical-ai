import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { CommunicationsModule } from '../communications/communications.module';

@Module({
  imports: [PrismaModule, CommunicationsModule],
  controllers: [AlertsController],
  providers: [AlertsService],
  exports: [AlertsService],
})
export class AlertsModule {}
