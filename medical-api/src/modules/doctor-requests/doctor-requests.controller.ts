import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DoctorRequestsService } from './doctor-requests.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RoleGuard } from '../../common/guards/role.guard';
import { UserRole } from '@prisma/client';

@ApiTags('doctor-requests')
@Controller('doctor-requests')
@ApiBearerAuth('JWT')
@UseGuards(AuthGuard('jwt'))
export class DoctorRequestsController {
  constructor(private readonly service: DoctorRequestsService) {}

  @Post()
  @ApiOperation({ summary: 'Request doctor review (Patient)' })
  async createRequest(
    @Request() req: any,
    @Body() body: { analysisId: string; specialty?: string; urgency?: string; notes?: string },
  ) {
    return this.service.createRequest(req.user.id, body);
  }

  @Get('my-requests')
  @ApiOperation({ summary: 'Get my doctor review requests (Patient)' })
  async getMyRequests(@Request() req: any) {
    return this.service.getPatientRequests(req.user.id);
  }

  @Get('queue')
  @UseGuards(RoleGuard)
  @Roles(UserRole.DOCTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get patient request queue (Doctor)' })
  async getDoctorQueue(@Request() req: any) {
    return this.service.getDoctorQueue(req.user.id);
  }

  @Patch(':id/claim')
  @UseGuards(RoleGuard)
  @Roles(UserRole.DOCTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Claim a patient request (Doctor)' })
  async claimRequest(@Param('id') id: string, @Request() req: any) {
    return this.service.claimRequest(id, req.user.id);
  }

  @Patch(':id/complete')
  @UseGuards(RoleGuard)
  @Roles(UserRole.DOCTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Mark request as completed (Doctor)' })
  async completeRequest(@Param('id') id: string, @Request() req: any) {
    return this.service.completeRequest(id, req.user.id);
  }
}
