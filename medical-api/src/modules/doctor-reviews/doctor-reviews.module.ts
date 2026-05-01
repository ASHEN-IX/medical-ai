import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { DoctorReviewsService } from './doctor-reviews.service';
import { DoctorReviewsController } from './doctor-reviews.controller';

@Module({
  imports: [PrismaModule],
  providers: [DoctorReviewsService],
  controllers: [DoctorReviewsController],
  exports: [DoctorReviewsService],
})
export class DoctorReviewsModule {}
