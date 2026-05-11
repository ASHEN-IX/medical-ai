import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PreventionPlansController } from './prevention-plans.controller';
import { PreventionPlansService } from './prevention-plans.service';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [PreventionPlansController],
  providers: [PreventionPlansService],
  exports: [PreventionPlansService],
})
export class PreventionPlansModule {}
