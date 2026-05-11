import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { DynamicQuestionsService } from './dynamic-questions.service';

@Module({
  imports: [PrismaModule, NotificationsModule],
  providers: [DynamicQuestionsService],
  exports: [DynamicQuestionsService],
})
export class DynamicQuestionsModule {}
