import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '../../prisma/prisma.service';
import { AlertsService } from '../alerts/alerts.service';
import { NotificationsService } from '../notifications/notifications.service';

// Disease → Specialty mapping
const DISEASE_SPECIALTY_MAP: Record<string, string> = {
  kidney: 'Nephrology',
  diabetes: 'Endocrinology',
  heart: 'Cardiology',
  stroke: 'Neurology',
  autism: 'Developmental Pediatrics',
  liver: 'Hepatology',
  thyroid: 'Endocrinology',
};

function isWithinAvailability(current: string, from?: string | null, to?: string | null): boolean {
  if (!from || !to) return true; // Default to available if not set
  return current >= from && current <= to;
}

@Injectable()
export class CaseAssignmentsService {
  private readonly logger = new Logger(CaseAssignmentsService.name);
  private readonly aiServiceUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly alerts: AlertsService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {
    this.aiServiceUrl = this.config.get<string>('AI_SERVICE_URL') || 'http://ai-service:8001';
  }

  /** Auto-assign a specialist based on detected disease */
  async autoAssign(data: {
    patientId: string;
    analysisId: string;
    disease: string;
    priority?: string;
    notes?: string;
  }) {
    const specialty =
      DISEASE_SPECIALTY_MAP[data.disease.toLowerCase()] || 'Internal Medicine';

    // Find available doctors with matching specialty
    const candidates = await this.prisma.doctorProfile.findMany({
      where: {
        specialty: { contains: specialty, mode: 'insensitive' },
        verified: true,
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    const now = new Date();
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();
    const currentTimeStr = `${currentHour.toString().padStart(2, '0')}:${currentMin.toString().padStart(2, '0')}`;

    // Filter by caseload and availability
    const availableDoctors = candidates
      .filter((d) => d.currentCaseload < d.maxCaseload)
      .sort((a, b) => {
        // Sort primarily by availability (currently active doctors first)
        const aIsAvailable = isWithinAvailability(currentTimeStr, a.availableFrom, a.availableTo);
        const bIsAvailable = isWithinAvailability(currentTimeStr, b.availableFrom, b.availableTo);
        
        if (aIsAvailable && !bIsAvailable) return -1;
        if (!aIsAvailable && bIsAvailable) return 1;
        
        // Secondarily sort by caseload
        return a.currentCaseload - b.currentCaseload;
      });

    const analysis = await this.prisma.analysis.findUnique({
      where: { id: data.analysisId },
      select: { riskLevel: true },
    });

    let rankedDoctors = availableDoctors;
    if (availableDoctors.length > 1) {
      try {
        const response = await axios.post<{
          primary: { id: string };
          alternates?: Array<{ id: string }>;
          reasoning?: string;
          confidence_score?: number;
        }>(
          `${this.aiServiceUrl}/api/v1/specialist/assign`,
          {
            disease: data.disease,
            risk_level: analysis?.riskLevel || 'NORMAL',
            available_doctors: availableDoctors.map((doctor) => ({
              id: doctor.userId,
              name: doctor.user.name,
              specialty: doctor.specialty,
              experience_years: 0,
              current_caseload: doctor.currentCaseload,
              max_caseload: doctor.maxCaseload,
              rating: 5,
              verified: doctor.verified,
            })),
            patient_info: {
              patientId: data.patientId,
              analysisId: data.analysisId,
            },
            case_notes: data.notes || null,
          },
          { timeout: 15000 },
        );

        const orderedIds = [
          response.data.primary?.id,
          ...(response.data.alternates || []).map((alt) => alt.id),
        ].filter((id): id is string => Boolean(id));

        if (orderedIds.length > 0) {
          const byUserId = new Map(availableDoctors.map((doc) => [doc.userId, doc]));
          const llmOrdered = orderedIds
            .map((id) => byUserId.get(id))
            .filter((doc): doc is (typeof availableDoctors)[number] => Boolean(doc));

          const remaining = availableDoctors.filter(
            (doc) => !orderedIds.includes(doc.userId),
          );

          rankedDoctors = [...llmOrdered, ...remaining];
        }

        this.logger.log(
          `LLM specialist ranking applied for disease=${data.disease} risk=${analysis?.riskLevel || 'NORMAL'} confidence=${response.data.confidence_score ?? 'n/a'}`,
        );
      } catch (error: any) {
        this.logger.warn(
          `Specialist LLM ranking failed, falling back to local ranking: ${error?.message || 'unknown error'}`,
        );
      }
    }

    const assignedDoctor = rankedDoctors[0];

    const assignment = await this.prisma.caseAssignment.create({
      data: {
        patientId: data.patientId,
        doctorId: assignedDoctor?.userId || null,
        analysisId: data.analysisId,
        disease: data.disease,
        specialty,
        status: assignedDoctor ? 'ASSIGNED' : 'PENDING',
        priority: (data.priority as any) || 'NORMAL',
        notes: data.notes,
      },
      include: {
        patient: { select: { id: true, name: true, email: true } },
        doctor: { select: { id: true, name: true, email: true } },
        analysis: true,
      },
    });

    // Increment doctor caseload
    if (assignedDoctor) {
      await this.prisma.doctorProfile.update({
        where: { id: assignedDoctor.id },
        data: { currentCaseload: { increment: 1 } },
      });

      await this.alerts.createAlert({
        userId: assignedDoctor.userId,
        type: 'CASE_ASSIGNMENT',
        severity: 'INFO',
        title: 'New specialist case assigned',
        message: `A new ${specialty} case has been assigned to you for ${assignment.patient?.name || 'a patient'}.`,
        data: {
          assignmentId: assignment.id,
          patientId: data.patientId,
          analysisId: data.analysisId,
          disease: data.disease,
          specialty,
        },
        channels: ['in_app'],
      });

      // Use NotificationsService for structured notifications
      await this.notifications.notifyDoctorAssignment(
        assignedDoctor.userId,
        assignment.patient?.name || 'Patient',
        data.disease,
        specialty,
        data.analysisId,
        assignment.id,
      );

      // Notify patient about specialist assignment
      await this.notifications.notifyCaseAssignment(
        data.patientId,
        assignedDoctor.user.name,
        data.disease,
        specialty,
      );

      // Create history event
      await this.notifications.recordHistoryEvent(
        data.patientId,
        'APPOINTMENT',
        `${specialty} Specialist Assigned`,
        `Dr. ${assignedDoctor.user.name} has been assigned to your ${data.disease} case.`,
        assignment.id,
      );
    } else {
      // Notify patient that case is pending assignment
      await this.notifications.notify({
        userId: data.patientId,
        type: 'CASE_UPDATE',
        severity: 'INFO',
        title: 'Case Awaiting Specialist',
        message: `Your ${data.disease} case is awaiting specialist assignment. You will be notified once a doctor is available.`,
        channels: ['in_app', 'email'],
        data: { disease: data.disease, specialty },
      });
    }

    this.logger.log(
      `Case assigned: ${assignment.id} → ${assignedDoctor?.user.name || 'UNASSIGNED'} (${specialty})`,
    );

    return assignment;
  }

  async getPatientCases(patientId: string) {
    return this.prisma.caseAssignment.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
      include: {
        doctor: {
          select: {
            id: true,
            name: true,
            email: true,
            doctorProfile: true,
          },
        },
        analysis: true,
        appointments: true,
      },
    });
  }

  async getDoctorCases(doctorId: string) {
    return this.prisma.caseAssignment.findMany({
      where: { doctorId },
      orderBy: { createdAt: 'desc' },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            email: true,
            age: true,
            gender: true,
          },
        },
        analysis: true,
        appointments: true,
        prescriptions: true,
      },
    });
  }

  async updateStatus(id: string, status: string) {
    return this.prisma.caseAssignment.update({
      where: { id },
      data: { status: status as any },
    });
  }

  async getById(id: string) {
    const found = await this.prisma.caseAssignment.findUnique({
      where: { id },
      include: {
        patient: {
          select: { id: true, name: true, email: true, age: true, gender: true },
        },
        doctor: {
          select: { id: true, name: true, email: true, doctorProfile: true },
        },
        analysis: true,
        appointments: true,
        prescriptions: { include: { medications: true } },
      },
    });
    if (!found) throw new NotFoundException('Case not found');
    return found;
  }
}
