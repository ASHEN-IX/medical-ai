import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AnalysesService } from './analyses.service';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { RoleGuard } from '../../common/guards/role.guard';

@ApiTags('analyses')
@Controller('analyses')
@ApiBearerAuth('JWT')
@UseGuards(AuthGuard('jwt'))
export class AnalysesController {
  constructor(private readonly analysesService: AnalysesService) {}

  @Get('doctor/user/:userId')
  @UseGuards(AuthGuard('jwt'), RoleGuard)
  @Roles(UserRole.DOCTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all analyses for a specific user (doctor only)' })
  async getUserAnalysesForDoctor(
    @Param('userId') userId: string,
    @Request() req: any,
  ) {
    return this.analysesService.getUserAnalysesForDoctor(userId, req.user.role);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new analysis (test) result' })
  async createAnalysis(
    @Request() req: any,
    @Body()
    body: {
      testName: string;
      selectedModels: string[];
      features: Record<string, number>;
      symptoms: string[];
      results: Record<string, { risk: string; confidence: number }>;
    },
  ) {
    return this.analysesService.createAnalysis(req.user.id, body);
  }

  @Get('my-analyses')
  @ApiOperation({ summary: 'Get all analyses for the current user' })
  async getUserAnalyses(@Request() req: any) {
    return this.analysesService.getUserAnalyses(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific analysis by ID' })
  async getAnalysis(@Param('id') id: string, @Request() req: any) {
    return this.analysesService.getAnalysis(id, req.user.id, req.user.role);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an analysis' })
  async updateAnalysis(
    @Param('id') id: string,
    @Request() req: any,
    @Body()
    body: Partial<{
      testName: string;
      results: Record<string, { risk: string; confidence: number }>;
    }>,
  ) {
    return this.analysesService.updateAnalysis(
      id,
      req.user.id,
      req.user.role,
      body,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an analysis' })
  async deleteAnalysis(@Param('id') id: string, @Request() req: any) {
    await this.analysesService.deleteAnalysis(id, req.user.id, req.user.role);
  }
}
