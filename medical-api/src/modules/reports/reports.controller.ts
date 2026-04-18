import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';

@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Upload medical report metadata' })
  @ApiResponse({ status: 201, description: 'Report created' })
  async createReport(
    @Body() createReportDto: CreateReportDto,
    @Request() req: any,
  ) {
    return this.reportsService.createReport(req.user.id, createReportDto);
  }

  @Get('my-reports')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get current user reports' })
  @ApiResponse({ status: 200, description: 'Reports list' })
  async getMyReports(@Request() req: any) {
    return this.reportsService.getMyReports(req.user.id);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get report by ID' })
  @ApiResponse({ status: 200, description: 'Report found' })
  @ApiResponse({ status: 404, description: 'Report not found' })
  async getReport(@Param('id') id: string, @Request() req: any) {
    return this.reportsService.getReportById(id, req.user.id, req.user.role);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete report' })
  @ApiResponse({ status: 204, description: 'Report deleted' })
  async deleteReport(@Param('id') id: string, @Request() req: any) {
    await this.reportsService.deleteReport(id, req.user.id, req.user.role);
  }
}
