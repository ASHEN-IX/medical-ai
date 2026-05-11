import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AlertsService } from '../alerts/alerts.service';

@Injectable()
export class PrescriptionsService {
  private readonly logger = new Logger(PrescriptionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly alerts: AlertsService,
  ) {}

  async requestRefill(prescriptionId: string, userId: string) {
    const rx = await this.prisma.prescription.findUnique({
      where: { id: prescriptionId },
      include: { doctor: true, medications: true },
    });

    if (!rx) throw new NotFoundException('Prescription not found');
    if (rx.patientId !== userId) throw new Error('Unauthorized');

    // In a real system, this would create a 'RefillRequest' record.
    // For now, we alert the doctor.
    await this.alerts.createAlert({
      userId: rx.doctorId,
      type: 'CASE_UPDATE',
      severity: 'INFO',
      title: 'Medication Refill Request',
      message: `Patient has requested a refill for prescription containing: ${rx.medications.map((m) => m.name).join(', ')}.`,
      data: { prescriptionId: rx.id, patientId: userId },
    });

    this.logger.log(`Refill requested for rx ${prescriptionId} by user ${userId}`);
    return { success: true, message: 'Refill request sent to your doctor.' };
  }

  async getMyPrescriptions(userId: string) {
    return this.prisma.prescription.findMany({
      where: { patientId: userId },
      include: {
        doctor: { select: { id: true, name: true } },
        medications: { include: { reminders: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getUpcomingReminders(userId: string) {
    const now = new Date();
    return this.prisma.medicationReminder.findMany({
      where: {
        userId,
        taken: false,
        skipped: false,
        scheduledAt: { gte: now },
      },
      orderBy: { scheduledAt: 'asc' },
      include: {
        medication: {
          include: {
            prescription: {
              include: { doctor: { select: { id: true, name: true } } },
            },
          },
        },
      },
    });
  }

  async markReminderTaken(id: string, userId: string) {
    const reminder = await this.prisma.medicationReminder.findUnique({ where: { id } });
    if (!reminder || reminder.userId !== userId) throw new NotFoundException('Reminder not found');

    return this.prisma.medicationReminder.update({
      where: { id },
      data: { taken: true, takenAt: new Date(), skipped: false },
    });
  }

  async markReminderSkipped(id: string, userId: string, notes?: string) {
    const reminder = await this.prisma.medicationReminder.findUnique({ where: { id } });
    if (!reminder || reminder.userId !== userId) throw new NotFoundException('Reminder not found');

    return this.prisma.medicationReminder.update({
      where: { id },
      data: { skipped: true, notes: notes || null },
    });
  }

  async getAdherenceSummary(userId: string) {
    const reminders = await this.prisma.medicationReminder.findMany({
      where: { userId },
      select: { taken: true, skipped: true, scheduledAt: true },
    });

    const taken = reminders.filter((reminder) => reminder.taken).length;
    const skipped = reminders.filter((reminder) => reminder.skipped).length;
    const missed = reminders.filter(
      (reminder) => !reminder.taken && !reminder.skipped && reminder.scheduledAt < new Date(),
    ).length;
    const total = reminders.length;
    const adherenceRate = total > 0 ? Math.round((taken / total) * 100) : 0;

    return {
      total,
      taken,
      skipped,
      missed,
      adherenceRate,
    };
  }
}
