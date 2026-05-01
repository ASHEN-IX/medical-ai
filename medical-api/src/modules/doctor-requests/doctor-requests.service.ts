import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRole } from '@prisma/client';

@Injectable()
export class DoctorRequestsService {
  private readonly logger = new Logger(DoctorRequestsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createRequest(
    patientId: string,
    data: { analysisId: string; specialty?: string; urgency?: string; notes?: string },
  ) {
    const analysis = await this.prisma.analysis.findUnique({
      where: { id: data.analysisId },
    });

    if (!analysis || analysis.userId !== patientId) {
      throw new NotFoundException('Analysis not found');
    }

    const doctor = data.specialty
      ? await this.prisma.user.findFirst({
          where: {
            role: 'DOCTOR',
            doctorProfile: { specialty: { contains: data.specialty, mode: 'insensitive' } },
          },
        })
      : await this.prisma.user.findFirst({ where: { role: 'DOCTOR' } });

    const request = await this.prisma.doctorRequest.create({
      data: {
        patientId,
        doctorId: doctor?.id || null,
        analysisId: data.analysisId,
        specialty: data.specialty,
        urgency: (data.urgency as any) || 'NORMAL',
        status: doctor ? 'ASSIGNED' : 'PENDING',
        notes: data.notes,
      },
      include: {
        patient: { select: { id: true, name: true, email: true } },
        doctor: { select: { id: true, name: true, email: true } },
        analysis: true,
      },
    });

    await this.prisma.log.create({
      data: {
        userId: patientId,
        action: 'DOCTOR_REQUEST_CREATED',
        metadata: {
          requestId: request.id,
          analysisId: data.analysisId,
          urgency: data.urgency,
        },
      },
    });

    this.logger.log(`Doctor request created: ${request.id}`);
    return request;
  }

  async getPatientRequests(patientId: string) {
    return this.prisma.doctorRequest.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
      include: {
        doctor: {
          select: { id: true, name: true, email: true, doctorProfile: true },
        },
        analysis: {
          select: {
            id: true,
            testName: true,
            healthScore: true,
            riskLevel: true,
            createdAt: true,
          },
        },
      },
    });
  }

  async getDoctorQueue(doctorId: string) {
    return this.prisma.doctorRequest.findMany({
      where: {
        OR: [{ doctorId }, { doctorId: null, status: 'PENDING' }],
        status: { in: ['PENDING', 'ASSIGNED', 'IN_REVIEW'] },
      },
      orderBy: [
        { urgency: 'desc' },
        { createdAt: 'asc' },
      ],
      include: {
        patient: {
          select: { id: true, name: true, email: true, age: true, gender: true },
        },
        analysis: {
          select: {
            id: true,
            testName: true,
            selectedModels: true,
            features: true,
            symptoms: true,
            results: true,
            healthScore: true,
            riskLevel: true,
            keyFindings: true,
            aiInsights: true,
            createdAt: true,
          },
        },
      },
    });
  }

  async claimRequest(requestId: string, doctorId: string) {
    const request = await this.prisma.doctorRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) throw new NotFoundException('Request not found');
    if (request.status === 'COMPLETED')
      throw new ForbiddenException('Request already completed');

    return this.prisma.doctorRequest.update({
      where: { id: requestId },
      data: { doctorId, status: 'IN_REVIEW' },
      include: {
        patient: { select: { id: true, name: true, email: true } },
        analysis: true,
      },
    });
  }

  async completeRequest(requestId: string, doctorId: string) {
    const request = await this.prisma.doctorRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) throw new NotFoundException('Request not found');
    if (request.doctorId !== doctorId)
      throw new ForbiddenException('Not assigned to you');

    return this.prisma.doctorRequest.update({
      where: { id: requestId },
      data: { status: 'COMPLETED' },
    });
  }
}
