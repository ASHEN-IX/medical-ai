import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DoctorReviewsService } from './doctor-reviews.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RoleGuard } from '../../common/guards/role.guard';
import { UserRole } from '@prisma/client';

@ApiTags('doctor-reviews')
@Controller('doctor-reviews')
@ApiBearerAuth('JWT')
@UseGuards(AuthGuard('jwt'))
export class DoctorReviewsController {
  constructor(private readonly service: DoctorReviewsService) {}

  @Post()
  @UseGuards(RoleGuard)
  @Roles(UserRole.DOCTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a doctor review for an analysis' })
  async createReview(
    @Request() req: any,
    @Body()
    body: {
      analysisId: string;
      diagnosis?: string;
      notes?: string;
      recommendations?: string[];
      prescription?: string;
      aiApproved?: boolean;
      aiCorrection?: string;
    },
  ) {
    return this.service.createReview(req.user.id, body);
  }

  @Get('analysis/:analysisId')
  @ApiOperation({ summary: 'Get reviews for an analysis' })
  async getReviewsForAnalysis(
    @Param('analysisId') analysisId: string,
    @Request() req: any,
  ) {
    return this.service.getReviewsForAnalysis(
      analysisId,
      req.user.id,
      req.user.role,
    );
  }

  @Get('my-reviews')
  @UseGuards(RoleGuard)
  @Roles(UserRole.DOCTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all reviews by current doctor' })
  async getMyReviews(@Request() req: any) {
    return this.service.getDoctorReviews(req.user.id);
  }

  @Get('feedback-stats')
  @UseGuards(RoleGuard)
  @Roles(UserRole.DOCTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get AI feedback loop statistics' })
  async getFeedbackStats(@Request() req: any) {
    return this.service.getFeedbackStats(
      req.user.role === UserRole.ADMIN ? undefined : req.user.id,
    );
  }
}
