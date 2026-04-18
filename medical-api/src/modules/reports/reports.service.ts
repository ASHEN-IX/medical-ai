import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateReportDto } from './dto/create-report.dto';
import { MedicalReport, UserRole } from '@prisma/client';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createReport(
    userId: string,
    createReportDto: CreateReportDto,
  ): Promise<MedicalReport> {
    const report = await this.prisma.medicalReport.create({
      data: {
        userId,
        fileUrl: createReportDto.fileUrl,
        fileName: createReportDto.fileName,
        extractedData: createReportDto.extractedData,
      },
    });

    this.logger.log(`✅ Medical report created: ${report.id} for user ${userId}`);

    // Log this action
    await this.prisma.log.create({
      data: {
        userId,
        action: 'REPORT_UPLOAD',
        metadata: {
          reportId: report.id,
          fileName: report.fileName,
        },
      },
    });

    return report;
  }

  async getReportById(
    reportId: string,
    userId: string,
    userRole: UserRole,
  ): Promise<MedicalReport> {
    const report = await this.prisma.medicalReport.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      throw new NotFoundException(`Report with id ${reportId} not found`);
    }

    // Users can only see their own reports, doctors and admins can see all
    if (
      report.userId !== userId &&
      userRole !== UserRole.DOCTOR &&
      userRole !== UserRole.ADMIN
    ) {
      throw new ForbiddenException('Access denied');
    }

    return report;
  }

  async getMyReports(userId: string): Promise<MedicalReport[]> {
    return this.prisma.medicalReport.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAllReports(userRole: UserRole): Promise<MedicalReport[]> {
    if (userRole !== UserRole.DOCTOR && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Only doctors and admins can view all reports');
    }

    return this.prisma.medicalReport.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteReport(
    reportId: string,
    userId: string,
    userRole: UserRole,
  ): Promise<void> {
    const report = await this.getReportById(reportId, userId, userRole);

    if (
      report.userId !== userId &&
      userRole !== UserRole.ADMIN
    ) {
      throw new ForbiddenException('You can only delete your own reports');
    }

    await this.prisma.medicalReport.delete({
      where: { id: reportId },
    });

    this.logger.log(`✅ Medical report deleted: ${reportId}`);
  }
}
