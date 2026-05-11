import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ConsultationHistoryService {
  private readonly logger = new Logger(ConsultationHistoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  async addEvent(data: {
    userId: string;
    eventType: string;
    title: string;
    summary?: string;
    metadata?: any;
    refId?: string;
  }) {
    return this.prisma.consultationHistoryEvent.create({
      data: {
        userId: data.userId,
        eventType: data.eventType as any,
        title: data.title,
        summary: data.summary,
        metadata: data.metadata,
        refId: data.refId,
      },
    });
  }

  async getTimeline(userId: string, filters?: { eventType?: string; limit?: number }) {
    return this.prisma.consultationHistoryEvent.findMany({
      where: {
        userId,
        ...(filters?.eventType ? { eventType: filters.eventType as any } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: filters?.limit || 50,
    });
  }

  /** Build unified timeline from all sources */
  async getUnifiedTimeline(userId: string) {
    const [analyses, appointments, prescriptions, manualTests, alerts, bookings] =
      await Promise.all([
        this.prisma.analysis.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: { id: true, testName: true, riskLevel: true, createdAt: true, healthScore: true },
        }),
        this.prisma.appointment.findMany({
          where: { OR: [{ patientId: userId }, { doctorId: userId }] },
          orderBy: { scheduledAt: 'desc' },
          take: 10,
          include: { doctor: { select: { name: true } }, patient: { select: { name: true } } },
        }),
        this.prisma.prescription.findMany({
          where: { OR: [{ patientId: userId }, { doctorId: userId }] },
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { medications: { select: { name: true, dosage: true } } },
        }),
        this.prisma.manualTest.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
        this.prisma.alert.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
        this.prisma.transportationBooking.findMany({
          where: { userId },
          orderBy: { scheduledAt: 'desc' },
          take: 5,
        }),
      ]);

    // Merge into unified timeline
    const timeline: Array<{ type: string; date: string; data: any }> = [
      ...analyses.map((a) => ({ type: 'AI_ANALYSIS', date: a.createdAt.toISOString(), data: a })),
      ...appointments.map((a) => ({ type: 'APPOINTMENT', date: a.scheduledAt.toISOString(), data: a })),
      ...prescriptions.map((p) => ({ type: 'PRESCRIPTION', date: p.createdAt.toISOString(), data: p })),
      ...manualTests.map((t) => ({ type: 'MANUAL_TEST', date: t.createdAt.toISOString(), data: t })),
      ...alerts.map((a) => ({ type: 'ALERT', date: a.createdAt.toISOString(), data: a })),
      ...bookings.map((b) => ({ type: 'TRANSPORT', date: b.scheduledAt.toISOString(), data: b })),
    ];

    timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return timeline;
  }
}
