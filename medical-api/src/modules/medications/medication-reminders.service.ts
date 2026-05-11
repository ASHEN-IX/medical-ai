import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ConfigService } from '@nestjs/config';

/**
 * MedicationRemindersService
 * Handles medication reminder scheduling and tracking
 * 
 * Setup required:
 * 1. npm install bull redis
 * 2. Add REDIS_URL to .env
 * 3. Start Redis server
 * 
 * When fully integrated with Bull:
 * - Reminders stored in queue
 * - Automatic processing every minute
 * - Persistent if Redis is available
 */
@Injectable()
export class MedicationRemindersService implements OnModuleInit {
  private readonly logger = new Logger(MedicationRemindersService.name);
  private reminderInterval: NodeJS.Timeout | null = null;
  private readonly notifiedReminderIds = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    // Start reminder processing loop if not using Bull yet
    this.startReminderProcessor();
  }

  /**
   * Create medication reminders for a prescription
   * Called when doctor writes prescription with medications
   */
  async createReminders(
    userId: string,
    medicationId: string,
    medication: any, // Medication record
  ): Promise<any[]> {
    const reminders: any[] = [];

    // Parse frequency string like "twice daily" to schedule
    const schedules = this.parseFrequency(medication.frequency);

    if (schedules.length === 0) {
      this.logger.warn(`Could not parse frequency: ${medication.frequency}`);
      return [];
    }

    // Create reminder for each scheduled time
    for (const hour of schedules) {
      const scheduledAt = new Date();
      scheduledAt.setHours(hour, Math.floor(Math.random() * 60), 0, 0); // Random minute for distribution

      const reminder = await this.prisma.medicationReminder.create({
        data: {
          medicationId,
          userId,
          scheduledAt,
          taken: false,
          skipped: false,
        },
      });

      reminders.push(reminder);

      this.logger.debug(
        `Reminder created: ${medication.name} at ${scheduledAt.toLocaleTimeString()} for user ${userId}`,
      );
    }

    return reminders;
  }

  /**
   * Get upcoming reminders for a user
   */
  async getUpcomingReminders(userId: string, hoursAhead: number = 24): Promise<any[]> {
    const now = new Date();
    const futureDate = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

    return this.prisma.medicationReminder.findMany({
      where: {
        userId,
        taken: false,
        skipped: false,
        scheduledAt: {
          gte: now,
          lte: futureDate,
        },
      },
      include: {
        medication: {
          include: {
            prescription: true,
          },
        },
      },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  /**
   * Mark reminder as taken
   */
  async markReminder(reminderId: string, taken: boolean = true): Promise<any> {
    const reminder = await this.prisma.medicationReminder.update({
      where: { id: reminderId },
      data: {
        taken,
        takenAt: taken ? new Date() : null,
      },
      include: { medication: true, user: true },
    });

    this.logger.debug(
      `Reminder marked ${taken ? 'taken' : 'not taken'}: ${reminder.medication.name} for ${reminder.user.name}`,
    );

    return reminder;
  }

  /**
   * Skip reminder (e.g., out of medication, side effects)
   */
  async skipReminder(reminderId: string, reason?: string): Promise<any> {
    const reminder = await this.prisma.medicationReminder.update({
      where: { id: reminderId },
      data: {
        skipped: true,
        notes: reason || null,
      },
      include: { medication: true, user: true },
    });

    this.logger.debug(
      `Reminder skipped: ${reminder.medication.name} for ${reminder.user.name}${reason ? ` (${reason})` : ''}`,
    );

    return reminder;
  }

  /**
   * Get adherence report for a medication
   */
  async getAdherenceReport(medicationId: string): Promise<{
    total: number;
    taken: number;
    skipped: number;
    missed: number;
    adherencePercent: number;
  }> {
    const reminders = await this.prisma.medicationReminder.findMany({
      where: { medicationId },
    });

    const now = new Date();
    const taken = reminders.filter((r) => r.taken).length;
    const skipped = reminders.filter((r) => r.skipped).length;
    const missed = reminders.filter(
      (r) => !r.taken && !r.skipped && r.scheduledAt < now,
    ).length;

    return {
      total: reminders.length,
      taken,
      skipped,
      missed,
      adherencePercent: reminders.length > 0 ? Math.round((taken / reminders.length) * 100) : 0,
    };
  }

  /**
   * Get adherence report for a user across all medications
   */
  async getUserAdherenceReport(userId: string, days: number = 30): Promise<any> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const reminders = await this.prisma.medicationReminder.findMany({
      where: {
        userId,
        createdAt: { gte: startDate },
      },
      include: { medication: true },
    });

    const medicationStats: Record<string, any> = {};

    for (const reminder of reminders) {
      const medName = reminder.medication.name;
      if (!medicationStats[medName]) {
        medicationStats[medName] = { total: 0, taken: 0, skipped: 0, missed: 0 };
      }

      medicationStats[medName].total += 1;
      if (reminder.taken) medicationStats[medName].taken += 1;
      if (reminder.skipped) medicationStats[medName].skipped += 1;

      const now = new Date();
      if (!reminder.taken && !reminder.skipped && reminder.scheduledAt < now) {
        medicationStats[medName].missed += 1;
      }
    }

    // Calculate adherence percentages
    for (const medName in medicationStats) {
      const stats = medicationStats[medName];
      stats.adherencePercent =
        stats.total > 0 ? Math.round((stats.taken / stats.total) * 100) : 0;
    }

    return medicationStats;
  }

  /**
   * Detect non-adherence and generate alerts
   */
  async checkNonAdherence(userId: string): Promise<void> {
    const upcomingReminders = await this.getUpcomingReminders(userId, 24);
    const now = new Date();

    // Check for missed reminders in the past
    const missedReminders = await this.prisma.medicationReminder.findMany({
      where: {
        userId,
        taken: false,
        skipped: false,
        scheduledAt: { lt: now },
      },
      include: { medication: true },
    });

    if (missedReminders.length >= 2) {
      const medicationNames = missedReminders.map((r) => r.medication.name).join(', ');
      await this.notifications.notifyMedicationNonAdherence(userId, medicationNames, 1);

      this.logger.warn(`Non-adherence detected for user ${userId}: ${medicationNames}`);
    }
  }

  /**
   * Process reminders - send notifications to users with due reminders
   * This runs every minute via the reminder processor loop
   */
  private async processReminders(): Promise<void> {
    try {
      const now = new Date();
      const fiveMinutesAhead = new Date(now.getTime() + 5 * 60 * 1000);
      const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);

      // Find reminders near due time; prevent duplicate sends with in-memory de-duplication
      const dueReminders = await this.prisma.medicationReminder.findMany({
        where: {
          taken: false,
          skipped: false,
          scheduledAt: {
            gte: oneMinuteAgo,
            lte: fiveMinutesAhead,
          },
        },
        include: {
          medication: true,
          user: true,
        },
      });

      for (const reminder of dueReminders) {
        if (this.notifiedReminderIds.has(reminder.id)) {
          continue;
        }

        try {
          await this.notifications.notifyMedicationReminder(
            reminder.userId,
            reminder.medication.name,
            reminder.medication.dosage,
          );

          this.notifiedReminderIds.add(reminder.id);

          this.logger.debug(
            `Reminder notification sent for ${reminder.medication.name} to ${reminder.user.name}`,
          );
        } catch (err) {
          this.logger.error(`Failed to send reminder notification`, err);
        }
      }

      // Cleanup de-duplication cache for reminders that are no longer pending
      const pendingIds = new Set(
        (
          await this.prisma.medicationReminder.findMany({
            where: {
              taken: false,
              skipped: false,
              scheduledAt: { gte: oneMinuteAgo },
            },
            select: { id: true },
          })
        ).map((r) => r.id),
      );

      for (const notifiedId of this.notifiedReminderIds) {
        if (!pendingIds.has(notifiedId)) {
          this.notifiedReminderIds.delete(notifiedId);
        }
      }

      // Check for non-adherence
      const allUsers = await this.prisma.user.findMany({
        where: { role: 'PATIENT' },
        select: { id: true },
      });

      for (const user of allUsers) {
        await this.checkNonAdherence(user.id);
      }
    } catch (err) {
      this.logger.error('Error processing medication reminders', err);
    }
  }

  /**
   * Start reminder processor loop
   * Runs every minute until Bull queue is implemented
   */
  private startReminderProcessor(): void {
    // Run immediately, then every minute
    this.processReminders();

    this.reminderInterval = setInterval(() => {
      this.processReminders();
    }, 60 * 1000); // Every minute

    this.logger.log('Medication reminder processor started (polling every minute)');
  }

  /**
   * Stop reminder processor
   */
  onModuleDestroy() {
    if (this.reminderInterval) {
      clearInterval(this.reminderInterval);
      this.logger.log('Medication reminder processor stopped');
    }
  }

  /**
   * Parse frequency string to hours of day
   * Examples: "twice daily" → [8, 20], "three times daily" → [8, 14, 20], "once daily" → [9]
   */
  private parseFrequency(frequency: string): number[] {
    const lower = frequency.toLowerCase();

    // Common patterns
    if (lower.includes('once daily') || lower.includes('once a day') || lower.includes('1x daily')) {
      return [9]; // 9 AM
    }
    if (lower.includes('twice daily') || lower.includes('2x daily')) {
      return [9, 21]; // 9 AM and 9 PM
    }
    if (lower.includes('three times') || lower.includes('3x daily')) {
      return [8, 14, 20]; // 8 AM, 2 PM, 8 PM
    }
    if (lower.includes('four times') || lower.includes('4x daily')) {
      return [8, 12, 16, 20]; // 8 AM, 12 PM, 4 PM, 8 PM
    }
    if (lower.includes('every 8') || lower.includes('every 8 hours')) {
      return [8, 16]; // 8 AM, 4 PM (2x daily)
    }
    if (lower.includes('every 6') || lower.includes('every 6 hours')) {
      return [6, 12, 18]; // 6 AM, 12 PM, 6 PM (4x daily)
    }
    if (lower.includes('every 12') || lower.includes('every 12 hours')) {
      return [8, 20]; // 8 AM, 8 PM (2x daily)
    }
    if (lower.includes('bedtime') || lower.includes('evening')) {
      return [21]; // 9 PM
    }
    if (lower.includes('morning')) {
      return [8]; // 8 AM
    }

    // Default: once daily at 9 AM
    return [9];
  }

  /**
   * Delete old completed reminders (older than 90 days)
   */
  async cleanupOldReminders(daysOld: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await this.prisma.medicationReminder.deleteMany({
      where: {
        taken: true,
        createdAt: { lt: cutoffDate },
      },
    });

    this.logger.log(`Cleaned up ${result.count} old medication reminders`);

    return result.count;
  }
}
