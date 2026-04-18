import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePredictionDto } from './dto/create-prediction.dto';
import { Prediction, UserRole } from '@prisma/client';

@Injectable()
export class PredictionsService {
  private readonly logger = new Logger(PredictionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createPrediction(
    userId: string,
    createPredictionDto: CreatePredictionDto,
  ): Promise<Prediction> {
    // Verify report exists and belongs to user or user is doctor/admin
    const report = await this.prisma.medicalReport.findUnique({
      where: { id: createPredictionDto.reportId },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    const prediction = await this.prisma.prediction.create({
      data: {
        reportId: createPredictionDto.reportId,
        userId,
        disease: createPredictionDto.disease,
        confidence: createPredictionDto.confidence,
        explanation: createPredictionDto.explanation,
        metadata: createPredictionDto.metadata,
      },
    });

    this.logger.log(`✅ Prediction created: ${prediction.id}`);

    // Log this action
    await this.prisma.log.create({
      data: {
        userId,
        action: 'PREDICTION_CREATE',
        metadata: {
          predictionId: prediction.id,
          reportId: prediction.reportId,
          disease: prediction.disease,
        },
      },
    });

    return prediction;
  }

  async getPredictionsByReportId(
    reportId: string,
    userId: string,
    userRole: UserRole,
  ): Promise<Prediction[]> {
    // Verify report exists
    const report = await this.prisma.medicalReport.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    // Users can only see predictions for their own reports
    if (
      report.userId !== userId &&
      userRole !== UserRole.DOCTOR &&
      userRole !== UserRole.ADMIN
    ) {
      throw new ForbiddenException('Access denied');
    }

    return this.prisma.prediction.findMany({
      where: { reportId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPredictionById(
    predictionId: string,
    userId: string,
    userRole: UserRole,
  ): Promise<Prediction> {
    const prediction = await this.prisma.prediction.findUnique({
      where: { id: predictionId },
      include: { report: true },
    });

    if (!prediction) {
      throw new NotFoundException('Prediction not found');
    }

    // Users can only see their own predictions
    if (
      prediction.userId !== userId &&
      userRole !== UserRole.DOCTOR &&
      userRole !== UserRole.ADMIN
    ) {
      throw new ForbiddenException('Access denied');
    }

    return prediction;
  }

  async getAllPredictions(userRole: UserRole): Promise<Prediction[]> {
    if (userRole !== UserRole.DOCTOR && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Only doctors and admins can view all predictions',
      );
    }

    return this.prisma.prediction.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }
}
