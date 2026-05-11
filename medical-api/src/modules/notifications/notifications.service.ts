import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AlertsService } from '../alerts/alerts.service';
import { AlertSeverity, AlertType } from '@prisma/client';

export interface NotificationConfig {
  userId: string;
  type: AlertType;
  severity?: AlertSeverity;
  title: string;
  message: string;
  channels: string[]; // ['in_app', 'email', 'sms', 'push']
  data?: Record<string, any>;
  relatedId?: string; // Link to related entity (case, appointment, etc)
}

/**
 * Unified Notification Service
 * Single point of dispatch for all notifications across the system
 * Coordinates with AlertsService for persistence and external channels
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly alertsService: AlertsService,
  ) {}

  /**
   * Send notification to a single user
   */
  async notify(config: NotificationConfig): Promise<void> {
    try {
      // Validate user exists
      const user = await this.prisma.user.findUnique({
        where: { id: config.userId },
      });

      if (!user) {
        this.logger.warn(`Cannot notify non-existent user: ${config.userId}`);
        return;
      }

      // Create alert through AlertsService
      await this.alertsService.createAlert({
        userId: config.userId,
        type: config.type,
        severity: config.severity || 'INFO',
        title: config.title,
        message: config.message,
        data: {
          ...config.data,
          relatedId: config.relatedId,
        },
        channels: config.channels,
      });

      this.logger.debug(
        `Notification sent to ${user.name} (${config.type}): ${config.title}`,
      );
    } catch (err) {
      this.logger.error(`Failed to send notification to ${config.userId}`, err);
    }
  }

  /**
   * Send notification to multiple users
   */
  async notifyMany(
    userIds: string[],
    config: Omit<NotificationConfig, 'userId'>,
  ): Promise<void> {
    for (const userId of userIds) {
      await this.notify({ ...config, userId });
    }
  }

  /**
   * Notify patient about case assignment
   */
  async notifyCaseAssignment(
    patientId: string,
    doctorName: string,
    disease: string,
    specialty: string,
  ): Promise<void> {
    await this.notify({
      userId: patientId,
      type: 'CASE_ASSIGNMENT',
      severity: 'INFO',
      title: 'Specialist Assigned',
      message: `${doctorName} has been assigned to your ${disease} case.`,
      channels: ['in_app', 'email'],
      data: { disease, specialty, doctorName },
    });
  }

  /**
   * Notify doctor about case assignment
   */
  async notifyDoctorAssignment(
    doctorId: string,
    patientName: string,
    disease: string,
    specialty: string,
    analysisId: string,
    caseId: string,
  ): Promise<void> {
    await this.notify({
      userId: doctorId,
      type: 'CASE_ASSIGNMENT',
      severity: 'INFO',
      title: 'New Case Assigned',
      message: `${patientName} has been assigned to you for ${disease} consultation.`,
      channels: ['in_app', 'email'],
      data: { disease, specialty, patientName, analysisId, caseId },
      relatedId: caseId,
    });
  }

  /**
   * Notify about appointment confirmation
   */
  async notifyAppointmentConfirmed(
    userId: string,
    doctorName: string,
    date: Date,
    type: 'PATIENT' | 'DOCTOR',
  ): Promise<void> {
    const userType = type === 'PATIENT' ? 'Your appointment' : `Appointment with patient`;
    const dateStr = date.toLocaleString();

    await this.notify({
      userId,
      type: 'CASE_UPDATE',
      severity: 'INFO',
      title: 'Appointment Confirmed',
      message: `${userType} is confirmed for ${dateStr} with ${doctorName}.`,
      channels: ['in_app', 'email'],
      data: { appointmentDate: date, doctorName },
    });
  }

  /**
   * Notify about appointment reminder
   */
  async notifyAppointmentReminder(
    userId: string,
    doctorName: string,
    date: Date,
    hoursUntil: number,
  ): Promise<void> {
    const dateStr = date.toLocaleString();

    await this.notify({
      userId,
      type: 'CASE_UPDATE',
      severity: 'INFO',
      title: `Appointment in ${hoursUntil}h`,
      message: `Reminder: Your appointment with ${doctorName} is on ${dateStr}.`,
      channels: ['in_app', hoursUntil <= 1 ? 'sms' : 'email'],
      data: { appointmentDate: date, doctorName, hoursUntil },
    });
  }

  /**
   * Notify about critical health alert
   */
  async notifyCriticalRisk(
    userId: string,
    disease: string,
    riskLevel: string,
    confidence: number,
  ): Promise<void> {
    await this.notify({
      userId,
      type: 'CRITICAL_RISK',
      severity: riskLevel === 'CRITICAL' ? 'EMERGENCY' : 'CRITICAL',
      title: `${riskLevel} Risk Detected: ${disease}`,
      message: `AI analysis detected ${riskLevel} risk for ${disease} (${(confidence * 100).toFixed(0)}% confidence). Please contact your doctor immediately.`,
      channels: ['in_app', 'email', 'sms'],
      data: { disease, riskLevel, confidence },
    });
  }

  /**
   * Notify about new message
   */
  async notifyNewMessage(
    userId: string,
    senderName: string,
    preview: string,
  ): Promise<void> {
    await this.notify({
      userId,
      type: 'DOCTOR_MESSAGE',
      severity: 'INFO',
      title: `Message from ${senderName}`,
      message: preview.substring(0, 100),
      channels: ['in_app'],
      data: { senderName },
    });
  }

  /**
   * Notify about medication reminder
   */
  async notifyMedicationReminder(
    userId: string,
    medicationName: string,
    dosage: string,
  ): Promise<void> {
    await this.notify({
      userId,
      type: 'MEDICATION_REMINDER',
      severity: 'INFO',
      title: 'Time for Your Medication',
      message: `Reminder: Take ${medicationName} ${dosage}.`,
      channels: ['in_app', 'sms'],
      data: { medicationName, dosage },
    });
  }

  /**
   * Notify about prescription created
   */
  async notifyPrescriptionCreated(
    userId: string,
    doctorName: string,
    medicationCount: number,
  ): Promise<void> {
    await this.notify({
      userId,
      type: 'CASE_UPDATE',
      severity: 'INFO',
      title: 'New Prescription from Dr. ' + doctorName,
      message: `You have received a new prescription with ${medicationCount} medication(s).`,
      channels: ['in_app', 'email'],
      data: { doctorName, medicationCount },
    });
  }

  /**
   * Notify about refill request
   */
  async notifyRefillRequest(
    doctorId: string,
    patientName: string,
    medicationName: string,
  ): Promise<void> {
    await this.notify({
      userId: doctorId,
      type: 'CASE_UPDATE',
      severity: 'INFO',
      title: `Refill Request from ${patientName}`,
      message: `${patientName} has requested a refill for ${medicationName}.`,
      channels: ['in_app', 'email'],
      data: { patientName, medicationName },
    });
  }

  /**
   * Notify about missed appointment
   */
  async notifyMissedAppointment(
    userId: string,
    doctorName: string,
    date: Date,
  ): Promise<void> {
    const dateStr = date.toLocaleString();

    await this.notify({
      userId,
      type: 'MISSED_APPOINTMENT',
      severity: 'WARNING',
      title: 'Missed Appointment',
      message: `Your appointment with ${doctorName} on ${dateStr} was not completed.`,
      channels: ['in_app', 'email'],
      data: { doctorName, appointmentDate: date },
    });
  }

  /**
   * Notify about medication non-adherence
   */
  async notifyMedicationNonAdherence(
    userId: string,
    medicationName: string,
    missedDays: number,
  ): Promise<void> {
    await this.notify({
      userId,
      type: 'MEDICATION_NON_ADHERENCE',
      severity: 'WARNING',
      title: 'Medication Non-Adherence Alert',
      message: `You have missed ${medicationName} for ${missedDays} day(s). Please resume taking it as prescribed.`,
      channels: ['in_app', 'sms'],
      data: { medicationName, missedDays },
    });
  }

  /**
   * Notify about trend warning
   */
  async notifyTrendWarning(
    userId: string,
    metric: string,
    trend: string, // 'increasing', 'decreasing'
    currentValue: number,
  ): Promise<void> {
    await this.notify({
      userId,
      type: 'TREND_WARNING',
      severity: 'WARNING',
      title: `${metric} Trend Alert`,
      message: `Your ${metric.toLowerCase()} is ${trend} (current: ${currentValue}). Consider consulting your doctor.`,
      channels: ['in_app', 'email'],
      data: { metric, trend, currentValue },
    });
  }

  /**
   * Create consultation history event
   * Records all significant events in patient's care journey
   */
  async recordHistoryEvent(
    userId: string,
    eventType: string,
    title: string,
    summary?: string,
    refId?: string,
  ): Promise<void> {
    try {
      await this.prisma.consultationHistoryEvent.create({
        data: {
          userId,
          eventType: eventType as any,
          title,
          summary: summary || undefined,
          refId: refId || undefined,
        },
      });

      this.logger.debug(`History event recorded: ${eventType} for user ${userId}`);
    } catch (err) {
      this.logger.error(`Failed to record history event`, err);
    }
  }

  /**
   * Record audit log for HIPAA compliance
   */
  async auditLog(
    actorId: string,
    targetId: string | null,
    resource: string,
    action: string,
    details?: Record<string, any>,
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId,
          targetId: targetId || undefined,
          resource,
          action,
          details: details || undefined,
          ipAddress: undefined, // Set via middleware if available
        },
      });

      this.logger.debug(
        `Audit log: ${actorId} ${action} ${resource}${targetId ? ` on ${targetId}` : ''}`,
      );
    } catch (err) {
      this.logger.error(`Failed to create audit log`, err);
    }
  }
}
