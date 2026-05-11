import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  async create(data: {
    patientId: string;
    doctorId: string;
    caseAssignmentId?: string;
    scheduledAt: string;
    durationMinutes?: number;
    type?: string;
    notes?: string;
  }) {
    // Validate patient and doctor exist
    const patient = await this.prisma.user.findUnique({ where: { id: data.patientId } });
    const doctor = await this.prisma.user.findUnique({ where: { id: data.doctorId } });

    if (!patient || !doctor) {
      throw new NotFoundException('Patient or Doctor not found');
    }

    // Check for scheduling conflicts (doctor can't have overlapping appointments)
    const scheduledDate = new Date(data.scheduledAt);
    const endTime = new Date(scheduledDate.getTime() + (data.durationMinutes || 30) * 60 * 1000);

    const conflict = await this.prisma.appointment.findFirst({
      where: {
        doctorId: data.doctorId,
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        OR: [
          {
            scheduledAt: {
              gte: new Date(scheduledDate.getTime() - 60 * 60 * 1000),
              lt: endTime,
            },
          },
        ],
      },
    });

    if (conflict && data.type !== 'TELECONSULTATION') {
      throw new BadRequestException('Doctor has a scheduling conflict at this time');
    }

    const appointment = await this.prisma.appointment.create({
      data: {
        patientId: data.patientId,
        doctorId: data.doctorId,
        caseAssignmentId: data.caseAssignmentId,
        scheduledAt: scheduledDate,
        durationMinutes: data.durationMinutes || 30,
        type: (data.type as any) || 'IN_PERSON',
        notes: data.notes,
        status: 'SCHEDULED',
      },
      include: {
        patient: { select: { id: true, name: true, email: true } },
        doctor: { select: { id: true, name: true, email: true, doctorProfile: true } },
      },
    });

    // Send notifications
    await this.notifications.notifyAppointmentReminder(
      data.patientId,
      doctor.name,
      new Date(data.scheduledAt),
      24, // Assuming 24h reminder
    );

    await this.notifications.notify({
      userId: data.doctorId,
      type: 'CASE_UPDATE',
      severity: 'INFO',
      title: 'New Appointment Scheduled',
      message: `Appointment scheduled with ${patient.name} on ${new Date(data.scheduledAt).toLocaleString()}`,
      channels: ['in_app', 'email'],
      data: {
        appointmentId: appointment.id,
        patientId: data.patientId,
        scheduledAt: data.scheduledAt,
      },
    });

    // Create history event
    await this.notifications.recordHistoryEvent(
      data.patientId,
      'APPOINTMENT',
      'Appointment Scheduled',
      `Appointment scheduled with Dr. ${doctor.name} on ${new Date(data.scheduledAt).toLocaleString()}`,
      appointment.id,
    );

    this.logger.log(`Appointment created: ${appointment.id}`);

    return appointment;
  }

  async getPatientAppointments(patientId: string) {
    return this.prisma.appointment.findMany({
      where: { patientId },
      orderBy: { scheduledAt: 'desc' },
      include: {
        doctor: { select: { id: true, name: true, doctorProfile: true } },
        teleconsultation: true,
      },
    });
  }

  async getDoctorAppointments(doctorId: string) {
    return this.prisma.appointment.findMany({
      where: { doctorId },
      orderBy: { scheduledAt: 'desc' },
      include: {
        patient: { select: { id: true, name: true, age: true, gender: true } },
        teleconsultation: true,
      },
    });
  }

  async updateStatus(id: string, status: string, notes?: string) {
    const appt = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        patient: { select: { id: true, name: true, email: true } },
        doctor: { select: { id: true, name: true, email: true } },
      },
    });

    if (!appt) throw new NotFoundException('Appointment not found');

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: { status: status as any, notes },
      include: {
        patient: { select: { id: true, name: true, email: true } },
        doctor: { select: { id: true, name: true, email: true } },
      },
    });

    // Send status change notifications
    if (status === 'CONFIRMED') {
      await this.notifications.notify({
        userId: appt.patientId,
        type: 'CASE_UPDATE',
        severity: 'INFO',
        title: 'Appointment Confirmed',
        message: `Your appointment with Dr. ${appt.doctor.name} is confirmed.`,
        channels: ['in_app', 'email'],
        data: { appointmentId: id },
      });
    } else if (status === 'CANCELLED') {
      await this.notifications.notify({
        userId: appt.patientId,
        type: 'CASE_UPDATE',
        severity: 'WARNING',
        title: 'Appointment Cancelled',
        message: `Your appointment with Dr. ${appt.doctor.name} has been cancelled.${notes ? ` Reason: ${notes}` : ''}`,
        channels: ['in_app', 'email'],
        data: { appointmentId: id },
      });

      await this.notifications.notify({
        userId: appt.doctorId,
        type: 'CASE_UPDATE',
        severity: 'INFO',
        title: 'Appointment Cancelled',
        message: `Appointment with ${appt.patient.name} has been cancelled.`,
        channels: ['in_app', 'email'],
        data: { appointmentId: id },
      });
    } else if (status === 'COMPLETED') {
      await this.notifications.recordHistoryEvent(
        appt.patientId,
        'APPOINTMENT',
        'Appointment Completed',
        `Consultation with Dr. ${appt.doctor.name} completed`,
        id,
      );
    }

    this.logger.log(`Appointment ${id} status updated to ${status}`);

    return updated;
  }

  async cancel(id: string, reason?: string) {
    return this.updateStatus(id, 'CANCELLED', reason);
  }

  async createTeleconsultation(appointmentId: string) {
    return this.prisma.teleconsultation.create({
      data: { appointmentId },
      include: { appointment: true },
    });
  }

  async getTeleconsultation(roomId: string) {
    const tc = await this.prisma.teleconsultation.findUnique({
      where: { roomId },
      include: {
        appointment: {
          include: {
            patient: { select: { id: true, name: true } },
            doctor: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!tc) throw new NotFoundException('Teleconsultation room not found');
    return tc;
  }

  async updateTeleconsultationStatus(roomId: string, status: string, sessionNotes?: string) {
    return this.prisma.teleconsultation.update({
      where: { roomId },
      data: {
        status: status as any,
        ...(status === 'ACTIVE' ? { startedAt: new Date() } : {}),
        ...(status === 'ENDED' ? { endedAt: new Date() } : {}),
        ...(sessionNotes ? { sessionNotes } : {}),
      },
    });
  }

  /**
   * Get upcoming appointments (next 30 days)
   */
  async getUpcomingAppointments(
    filter?: { patientId?: string; doctorId?: string },
  ): Promise<any[]> {
    const now = new Date();
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    return this.prisma.appointment.findMany({
      where: {
        scheduledAt: { gte: now, lte: thirtyDaysLater },
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        ...(filter?.patientId && { patientId: filter.patientId }),
        ...(filter?.doctorId && { doctorId: filter.doctorId }),
      },
      orderBy: { scheduledAt: 'asc' },
      include: {
        patient: { select: { id: true, name: true, email: true } },
        doctor: { select: { id: true, name: true, email: true } },
      },
    });
  }

  /**
   * Check for appointments that need reminders (within 24 hours)
   */
  async checkForReminderAppointments(): Promise<any[]> {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    return this.prisma.appointment.findMany({
      where: {
        scheduledAt: { gte: now, lte: tomorrow },
        status: { in: ['SCHEDULED', 'CONFIRMED'] },
      },
      include: {
        patient: { select: { id: true, name: true, email: true } },
        doctor: { select: { id: true, name: true, email: true } },
      },
    });
  }

  /**
   * Mark appointment reminder as sent
   */
  async markReminderSent(appointmentId: string): Promise<any> {
    // Instead of updating a non-existent field, record a notification and history event
    const appt = await this.prisma.appointment.findUnique({ where: { id: appointmentId }, include: { patient: true, doctor: true } });
    if (!appt) throw new NotFoundException('Appointment not found');

    // Compute hoursUntil
    const hoursUntil = Math.max(0, Math.round((new Date(appt.scheduledAt).getTime() - Date.now()) / (1000 * 60 * 60)));

    await this.notifications.notifyAppointmentReminder(appt.patientId, appt.doctor.name, new Date(appt.scheduledAt), hoursUntil);

    await this.notifications.recordHistoryEvent(
      appt.patientId,
      'APPOINTMENT',
      'Appointment Reminder Sent',
      `Reminder sent for appointment ${appointmentId}`,
      appointmentId,
    );

    return { success: true };
  }

  /**
   * Mark appointment as no-show
   */
  async markNoShow(appointmentId: string, reason?: string): Promise<any> {
    const appt = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        patient: { select: { id: true, name: true, email: true } },
        doctor: { select: { id: true, name: true, email: true } },
      },
    });

    if (!appt) throw new NotFoundException('Appointment not found');

    const updated = await this.updateStatus(appointmentId, 'NO_SHOW', reason);

    // Notify patient about no-show
    await this.notifications.notify({
      userId: appt.patientId,
      type: 'MISSED_APPOINTMENT',
      severity: 'WARNING',
      title: 'Appointment Marked as No-Show',
      message: `Your appointment with Dr. ${appt.doctor.name} was marked as no-show. Please reschedule.`,
      channels: ['in_app', 'email'],
      data: { appointmentId },
    });

    return updated;
  }

  /**
   * Reschedule an appointment
   */
  async reschedule(
    appointmentId: string,
    newScheduledAt: string,
  ): Promise<any> {
    const appt = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        patient: { select: { id: true, name: true, email: true } },
        doctor: { select: { id: true, name: true, email: true } },
      },
    });

    if (!appt) throw new NotFoundException('Appointment not found');

    const newDate = new Date(newScheduledAt);
    const endTime = new Date(newDate.getTime() + (appt.durationMinutes || 30) * 60 * 1000);

    // Check for conflicts at new time
    const conflict = await this.prisma.appointment.findFirst({
      where: {
        id: { not: appointmentId },
        doctorId: appt.doctorId,
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        OR: [
          {
            scheduledAt: {
              gte: new Date(newDate.getTime() - 60 * 60 * 1000),
              lt: endTime,
            },
          },
        ],
      },
    });

    if (conflict) {
      throw new BadRequestException('Doctor has a scheduling conflict at the new time');
    }

    const rescheduled = await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        scheduledAt: newDate,
        status: 'SCHEDULED',
      },
      include: {
        patient: { select: { id: true, name: true, email: true } },
        doctor: { select: { id: true, name: true, email: true } },
      },
    });

    // Notify both parties
    await this.notifications.notify({
      userId: appt.patientId,
      type: 'CASE_UPDATE',
      severity: 'INFO',
      title: 'Appointment Rescheduled',
      message: `Your appointment with Dr. ${appt.doctor.name} has been rescheduled to ${newDate.toLocaleString()}`,
      channels: ['in_app', 'email'],
      data: { appointmentId },
    });

    await this.notifications.notify({
      userId: appt.doctorId,
      type: 'CASE_UPDATE',
      severity: 'INFO',
      title: 'Appointment Rescheduled',
      message: `Appointment with ${appt.patient.name} has been rescheduled to ${newDate.toLocaleString()}`,
      channels: ['in_app', 'email'],
      data: { appointmentId },
    });

    this.logger.log(`Appointment ${appointmentId} rescheduled to ${newScheduledAt}`);

    return rescheduled;
  }

  /**
   * Get appointment statistics for a doctor
   */
  async getDoctorStats(doctorId: string, days: number = 30): Promise<any> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const appointments = await this.prisma.appointment.findMany({
      where: {
        doctorId,
        createdAt: { gte: startDate },
      },
    });

    return {
      total: appointments.length,
      scheduled: appointments.filter((a) => a.status === 'SCHEDULED').length,
      confirmed: appointments.filter((a) => a.status === 'CONFIRMED').length,
      completed: appointments.filter((a) => a.status === 'COMPLETED').length,
      cancelled: appointments.filter((a) => a.status === 'CANCELLED').length,
      noShow: appointments.filter((a) => a.status === 'NO_SHOW').length,
      noShowRate:
        appointments.length > 0
          ? (
              (appointments.filter((a) => a.status === 'NO_SHOW').length /
                appointments.length) *
              100
            ).toFixed(2) + '%'
          : '0%',
    };
  }

  /**
   * Get appointment statistics for a patient
   */
  async getPatientStats(patientId: string, days: number = 90): Promise<any> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const appointments = await this.prisma.appointment.findMany({
      where: {
        patientId,
        createdAt: { gte: startDate },
      },
    });

    return {
      total: appointments.length,
      completed: appointments.filter((a) => a.status === 'COMPLETED').length,
      cancelled: appointments.filter((a) => a.status === 'CANCELLED').length,
      noShow: appointments.filter((a) => a.status === 'NO_SHOW').length,
      scheduled: appointments.filter((a) => a.status === 'SCHEDULED' || a.status === 'CONFIRMED').length,
      lastAppointment: appointments.find((a) => a.status === 'COMPLETED')?.scheduledAt,
    };
  }
}
