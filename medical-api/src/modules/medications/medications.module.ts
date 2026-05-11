import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MedicationRemindersService } from './medication-reminders.service';

@Module({
  imports: [PrismaModule, NotificationsModule],
  providers: [MedicationRemindersService],
  exports: [MedicationRemindersService],
})
export class MedicationsModule {}
