import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ConsultationHistoryController } from './consultation-history.controller';
import { ConsultationHistoryService } from './consultation-history.service';

@Module({
  imports: [PrismaModule],
  controllers: [ConsultationHistoryController],
  providers: [ConsultationHistoryService],
  exports: [ConsultationHistoryService],
})
export class ConsultationHistoryModule {}
