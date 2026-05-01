import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { DoctorRequestsService } from './doctor-requests.service';
import { DoctorRequestsController } from './doctor-requests.controller';

@Module({
  imports: [PrismaModule],
  providers: [DoctorRequestsService],
  controllers: [DoctorRequestsController],
  exports: [DoctorRequestsService],
})
export class DoctorRequestsModule {}
