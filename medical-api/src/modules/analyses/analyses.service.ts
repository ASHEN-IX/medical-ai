import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRole } from '@prisma/client';

export interface AnalysisResult {
  id: string;
  userId: string;
  reportId: string | null;
  testName: string;
  selectedModels: string[];
  features: Record<string, number>;
  symptoms: string[];
  results: Record<string, { risk: string; confidence: number }>;
  healthScore: number | null;
  riskLevel: string;
  keyFindings: string[];
  aiInsights: string | null;
  status: string;
  createdAt: Date;
  doctorReviews?: any[];
}

@Injectable()
export class AnalysesService {
  private readonly logger = new Logger(AnalysesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createAnalysis(
    userId: string,
    data: {
      testName: string;
      selectedModels: string[];
      features: Record<string, number>;
      symptoms: string[];
      results: Record<string, { risk: string; confidence: number }>;
      healthScore?: number;
      riskLevel?: string;
      keyFindings?: string[];
      aiInsights?: string;
      reportId?: string;
    },
  ): Promise<AnalysisResult> {
    const analysis = await this.prisma.analysis.create({
      data: {
        userId,
        reportId: data.reportId || null,
        testName: data.testName,
        selectedModels: data.selectedModels,
        features: data.features,
        symptoms: data.symptoms,
        results: data.results,
        healthScore: data.healthScore || null,
        riskLevel: (data.riskLevel as any) || 'LOW',
        keyFindings: data.keyFindings || [],
        aiInsights: data.aiInsights || null,
        status: 'COMPLETED',
      },
    });

    this.logger.log(`Analysis created: ${analysis.id} for user ${userId}`);

    await this.prisma.log.create({
      data: {
        userId,
        action: 'ANALYSIS_CREATED',
        metadata: {
          analysisId: analysis.id,
          testName: data.testName,
          models: data.selectedModels,
          riskLevel: data.riskLevel,
        },
      },
    });

    return this.mapAnalysis(analysis);
  }

  async getUserAnalyses(userId: string): Promise<AnalysisResult[]> {
    const analyses = await this.prisma.analysis.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        doctorReviews: {
          include: {
            doctor: { select: { id: true, name: true } },
          },
        },
      },
    });

    return analyses.map((a) => this.mapAnalysis(a));
  }

  async getAnalysis(
    analysisId: string,
    userId: string,
    userRole: UserRole,
  ): Promise<AnalysisResult> {
    const analysis = await this.prisma.analysis.findUnique({
      where: { id: analysisId },
      include: {
        doctorReviews: {
          include: {
            doctor: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!analysis) {
      throw new NotFoundException('Analysis not found');
    }

    if (userRole === 'PATIENT' && analysis.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to view this analysis',
      );
    }

    return this.mapAnalysis(analysis);
  }

  async getUserAnalysesForDoctor(
    targetUserId: string,
    userRole: UserRole,
  ): Promise<AnalysisResult[]> {
    if (userRole !== UserRole.DOCTOR && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Only doctors and admins can access this view');
    }

    const analyses = await this.prisma.analysis.findMany({
      where: { userId: targetUserId },
      orderBy: { createdAt: 'desc' },
      include: {
        doctorReviews: {
          include: {
            doctor: { select: { id: true, name: true } },
          },
        },
      },
    });

    return analyses.map((a) => this.mapAnalysis(a));
  }

  async updateAnalysis(
    analysisId: string,
    userId: string,
    userRole: UserRole,
    data: Partial<{
      testName: string;
      results: Record<string, { risk: string; confidence: number }>;
    }>,
  ): Promise<AnalysisResult> {
    const analysis = await this.prisma.analysis.findUnique({
      where: { id: analysisId },
    });

    if (!analysis) {
      throw new NotFoundException('Analysis not found');
    }

    if (userRole === 'PATIENT' && analysis.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to update this analysis',
      );
    }

    const updated = await this.prisma.analysis.update({
      where: { id: analysisId },
      data,
    });

    this.logger.log(`Analysis updated: ${analysisId}`);

    await this.prisma.log.create({
      data: {
        userId,
        action: 'ANALYSIS_UPDATED',
        metadata: { analysisId },
      },
    });

    return this.mapAnalysis(updated);
  }

  async deleteAnalysis(
    analysisId: string,
    userId: string,
    userRole: UserRole,
  ): Promise<void> {
    const analysis = await this.prisma.analysis.findUnique({
      where: { id: analysisId },
    });

    if (!analysis) {
      throw new NotFoundException('Analysis not found');
    }

    if (userRole === 'PATIENT' && analysis.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to delete this analysis',
      );
    }

    await this.prisma.analysis.delete({
      where: { id: analysisId },
    });

    this.logger.log(`Analysis deleted: ${analysisId}`);

    await this.prisma.log.create({
      data: {
        userId,
        action: 'ANALYSIS_DELETED',
        metadata: { analysisId },
      },
    });
  }

  private mapAnalysis(analysis: any): AnalysisResult {
    return {
      id: analysis.id,
      userId: analysis.userId,
      reportId: analysis.reportId || null,
      testName: analysis.testName,
      selectedModels: analysis.selectedModels || [],
      features: analysis.features || {},
      symptoms: analysis.symptoms || [],
      results: analysis.results || {},
      healthScore: analysis.healthScore,
      riskLevel: analysis.riskLevel || 'LOW',
      keyFindings: analysis.keyFindings || [],
      aiInsights: analysis.aiInsights || null,
      status: analysis.status || 'COMPLETED',
      createdAt: analysis.createdAt,
      doctorReviews: analysis.doctorReviews || [],
    };
  }
}
