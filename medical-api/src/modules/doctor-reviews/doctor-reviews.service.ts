import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRole } from '@prisma/client';

@Injectable()
export class DoctorReviewsService {
  private readonly logger = new Logger(DoctorReviewsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createReview(
    doctorId: string,
    data: {
      analysisId: string;
      diagnosis?: string;
      notes?: string;
      recommendations?: string[];
      prescription?: string;
      aiApproved?: boolean;
      aiCorrection?: string;
    },
  ) {
    const analysis = await this.prisma.analysis.findUnique({
      where: { id: data.analysisId },
    });

    if (!analysis) throw new NotFoundException('Analysis not found');

    const review = await this.prisma.doctorReview.create({
      data: {
        doctorId,
        analysisId: data.analysisId,
        diagnosis: data.diagnosis,
        notes: data.notes,
        recommendations: data.recommendations || [],
        prescription: data.prescription,
        aiApproved: data.aiApproved,
        aiCorrection: data.aiCorrection,
      },
      include: {
        doctor: { select: { id: true, name: true, email: true } },
        analysis: true,
      },
    });

    await this.prisma.analysis.update({
      where: { id: data.analysisId },
      data: { status: 'REVIEWED' },
    });

    const relatedRequests = await this.prisma.doctorRequest.findMany({
      where: { analysisId: data.analysisId, doctorId, status: { not: 'COMPLETED' } },
    });

    for (const req of relatedRequests) {
      await this.prisma.doctorRequest.update({
        where: { id: req.id },
        data: { status: 'COMPLETED' },
      });
    }

    await this.prisma.log.create({
      data: {
        userId: doctorId,
        action: data.aiApproved === false ? 'AI_CORRECTION' : 'DOCTOR_REVIEW',
        metadata: {
          reviewId: review.id,
          analysisId: data.analysisId,
          aiApproved: data.aiApproved,
          aiCorrection: data.aiCorrection,
        },
      },
    });

    this.logger.log(`Doctor review created: ${review.id}`);
    return review;
  }

  async getReviewsForAnalysis(analysisId: string, userId: string, userRole: UserRole) {
    const analysis = await this.prisma.analysis.findUnique({
      where: { id: analysisId },
    });

    if (!analysis) throw new NotFoundException('Analysis not found');

    if (userRole === 'PATIENT' && analysis.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return this.prisma.doctorReview.findMany({
      where: { analysisId },
      orderBy: { createdAt: 'desc' },
      include: {
        doctor: {
          select: { id: true, name: true, doctorProfile: true },
        },
      },
    });
  }

  async getDoctorReviews(doctorId: string) {
    return this.prisma.doctorReview.findMany({
      where: { doctorId },
      orderBy: { createdAt: 'desc' },
      include: {
        analysis: {
          select: {
            id: true,
            testName: true,
            healthScore: true,
            riskLevel: true,
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });
  }

  async getFeedbackStats(doctorId?: string) {
    const where = doctorId ? { doctorId } : {};

    const total = await this.prisma.doctorReview.count({ where });
    const approved = await this.prisma.doctorReview.count({
      where: { ...where, aiApproved: true },
    });
    const corrected = await this.prisma.doctorReview.count({
      where: { ...where, aiApproved: false },
    });

    return {
      total,
      aiApproved: approved,
      aiCorrected: corrected,
      approvalRate: total > 0 ? Math.round((approved / total) * 100) : 0,
    };
  }
}
