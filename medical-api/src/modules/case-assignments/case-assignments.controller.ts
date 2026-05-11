import {
  Controller, Post, Get, Patch, Param, Body, UseGuards, Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CaseAssignmentsService } from './case-assignments.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RoleGuard } from '../../common/guards/role.guard';
import { UserRole } from '@prisma/client';

@ApiTags('case-assignments')
@Controller('case-assignments')
@ApiBearerAuth('JWT')
@UseGuards(AuthGuard('jwt'))
export class CaseAssignmentsController {
  constructor(private readonly service: CaseAssignmentsService) {}

  @Post('auto-assign')
  @ApiOperation({ summary: 'Auto-assign specialist based on disease' })
  async autoAssign(
    @Request() req: any,
    @Body() body: { analysisId: string; disease: string; priority?: string; notes?: string },
  ) {
    return this.service.autoAssign({ patientId: req.user.id, ...body });
  }

  @Get('my-cases')
  @ApiOperation({ summary: 'Get my cases (patient or doctor)' })
  async getMyCases(@Request() req: any) {
    if (req.user.role === 'DOCTOR' || req.user.role === 'ADMIN') {
      return this.service.getDoctorCases(req.user.id);
    }
    return this.service.getPatientCases(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get case by ID' })
  async getById(@Param('id') id: string) {
    return this.service.getById(id);
  }

  @Patch(':id/status')
  @UseGuards(RoleGuard)
  @Roles(UserRole.DOCTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update case status' })
  async updateStatus(
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    return this.service.updateStatus(id, body.status);
  }
}
