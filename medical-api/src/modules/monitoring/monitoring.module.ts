import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { MonitoringController } from './monitoring.controller';

@Module({
  imports: [PrismaModule],
  controllers: [MonitoringController],
})
export class MonitoringModule {}
