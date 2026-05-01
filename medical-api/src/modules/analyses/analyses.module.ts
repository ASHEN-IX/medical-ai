import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AnalysesService } from './analyses.service';
import { AnalysesController } from './analyses.controller';

@Module({
  imports: [PrismaModule],
  providers: [AnalysesService],
  controllers: [AnalysesController],
  exports: [AnalysesService],
})
export class AnalysesModule {}
