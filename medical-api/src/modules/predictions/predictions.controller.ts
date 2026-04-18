import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { PredictionsService } from './predictions.service';
import { CreatePredictionDto } from './dto/create-prediction.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RoleGuard } from '../../common/guards/role.guard';
import { UserRole } from '@prisma/client';

@ApiTags('predictions')
@Controller('predictions')
export class PredictionsController {
  constructor(private readonly predictionsService: PredictionsService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'), RoleGuard)
  @Roles(UserRole.DOCTOR, UserRole.ADMIN)
  @ApiBearerAuth('JWT')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create prediction (Doctor/Admin only)' })
  @ApiResponse({ status: 201, description: 'Prediction created' })
  async createPrediction(
    @Body() createPredictionDto: CreatePredictionDto,
    @Request() req: any,
  ) {
    return this.predictionsService.createPrediction(
      req.user.id,
      createPredictionDto,
    );
  }

  @Get('report/:reportId')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get predictions by report ID' })
  @ApiResponse({ status: 200, description: 'Predictions list' })
  async getPredictionsByReportId(
    @Param('reportId') reportId: string,
    @Request() req: any,
  ) {
    return this.predictionsService.getPredictionsByReportId(
      reportId,
      req.user.id,
      req.user.role,
    );
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get prediction by ID' })
  @ApiResponse({ status: 200, description: 'Prediction found' })
  @ApiResponse({ status: 404, description: 'Prediction not found' })
  async getPredictionById(@Param('id') id: string, @Request() req: any) {
    return this.predictionsService.getPredictionById(
      id,
      req.user.id,
      req.user.role,
    );
  }
}
