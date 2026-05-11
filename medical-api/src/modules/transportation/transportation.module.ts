import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AlertsModule } from '../alerts/alerts.module';
import { TransportationController } from './transportation.controller';
import { TransportationService } from './transportation.service';

@Module({
  imports: [PrismaModule, AlertsModule],
  controllers: [TransportationController],
  providers: [TransportationService],
  exports: [TransportationService],
})
export class TransportationModule {}
