import {
  Controller, Post, Get, Patch, Param, Body, UseGuards, Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AppointmentsService } from './appointments.service';

@ApiTags('appointments')
@Controller('appointments')
@ApiBearerAuth('JWT')
@UseGuards(AuthGuard('jwt'))
export class AppointmentsController {
  constructor(private readonly service: AppointmentsService) {}

  @Post()
  @ApiOperation({ summary: 'Book an appointment' })
  async create(
    @Request() req: any,
    @Body() body: {
      doctorId: string;
      patientId?: string;
      caseAssignmentId?: string;
      scheduledAt: string;
      durationMinutes?: number;
      type?: string;
      notes?: string;
    },
  ) {
    const patientId = (req.user.role === 'DOCTOR' || req.user.role === 'ADMIN') && body.patientId 
      ? body.patientId 
      : req.user.id;
    return this.service.create({ ...body, patientId });
  }

  @Get('my-appointments')
  @ApiOperation({ summary: 'Get my appointments' })
  async getMyAppointments(@Request() req: any) {
    if (req.user.role === 'DOCTOR' || req.user.role === 'ADMIN') {
      return this.service.getDoctorAppointments(req.user.id);
    }
    return this.service.getPatientAppointments(req.user.id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update appointment status' })
  async updateStatus(@Param('id') id: string, @Body() body: { status: string }) {
    return this.service.updateStatus(id, body.status);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel appointment' })
  async cancel(@Param('id') id: string) {
    return this.service.cancel(id);
  }

  @Post(':id/teleconsultation')
  @ApiOperation({ summary: 'Create teleconsultation for appointment' })
  async createTeleconsultation(@Param('id') id: string) {
    return this.service.createTeleconsultation(id);
  }

  @Get('teleconsultation/:roomId')
  @ApiOperation({ summary: 'Get teleconsultation by room ID' })
  async getTeleconsultation(@Param('roomId') roomId: string) {
    return this.service.getTeleconsultation(roomId);
  }

  @Patch('teleconsultation/:roomId/status')
  @ApiOperation({ summary: 'Update teleconsultation status' })
  async updateTeleStatus(
    @Param('roomId') roomId: string,
    @Body() body: { status: string; sessionNotes?: string },
  ) {
    return this.service.updateTeleconsultationStatus(roomId, body.status, body.sessionNotes);
  }
}
