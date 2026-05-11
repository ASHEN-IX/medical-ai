import { Controller, Get, Post, Patch, Param, Body, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PrescriptionsService } from './prescriptions.service';

@ApiTags('prescriptions')
@Controller('prescriptions')
@ApiBearerAuth('JWT')
@UseGuards(AuthGuard('jwt'))
export class PrescriptionsController {
  constructor(private readonly prescriptionsService: PrescriptionsService) {}

  @Get('my')
  @ApiOperation({ summary: 'Get current user prescriptions' })
  async getMy(@Request() req: any) {
    return this.prescriptionsService.getMyPrescriptions(req.user.id);
  }

  @Post(':id/refill')
  @ApiOperation({ summary: 'Request a refill for a prescription' })
  async requestRefill(@Param('id') id: string, @Request() req: any) {
    return this.prescriptionsService.requestRefill(id, req.user.id);
  }

  @Get('reminders/upcoming')
  @ApiOperation({ summary: 'Get upcoming medication reminders' })
  async getUpcomingReminders(@Request() req: any) {
    return this.prescriptionsService.getUpcomingReminders(req.user.id);
  }

  @Patch('reminders/:id/taken')
  @ApiOperation({ summary: 'Mark a medication reminder as taken' })
  async markReminderTaken(@Param('id') id: string, @Request() req: any) {
    return this.prescriptionsService.markReminderTaken(id, req.user.id);
  }

  @Patch('reminders/:id/skipped')
  @ApiOperation({ summary: 'Mark a medication reminder as skipped' })
  async markReminderSkipped(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: { notes?: string },
  ) {
    return this.prescriptionsService.markReminderSkipped(id, req.user.id, body.notes);
  }

  @Get('reminders/adherence-summary')
  @ApiOperation({ summary: 'Get medication adherence summary' })
  async getAdherenceSummary(@Request() req: any) {
    return this.prescriptionsService.getAdherenceSummary(req.user.id);
  }
}
