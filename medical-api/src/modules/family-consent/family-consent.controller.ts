import { Controller, Post, Get, Patch, Body, UseGuards, Request, Param } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FamilyConsentService } from './family-consent.service';
import { AuditLog } from '../../common/decorators/audit-log.decorator';

@ApiTags('family-consent')
@Controller('family-consent')
@ApiBearerAuth('JWT')
@UseGuards(AuthGuard('jwt'))
export class FamilyConsentController {
  constructor(private readonly service: FamilyConsentService) {}

  @Post('grant')
  @ApiOperation({ summary: 'Grant medical data access to a caregiver' })
  @AuditLog({ resource: 'FamilyConsent', action: 'CREATE' })
  async grant(@Request() req: any, @Body() body: { caregiverId: string; accessLevel: string; expiresAt?: string }) {
    return this.service.grantConsent(
      req.user.id,
      body.caregiverId,
      body.accessLevel,
      body.expiresAt ? new Date(body.expiresAt) : undefined,
    );
  }

  @Patch('revoke/:caregiverId')
  @ApiOperation({ summary: 'Revoke medical data access from a caregiver' })
  @AuditLog({ resource: 'FamilyConsent', action: 'REVOKE' })
  async revoke(@Request() req: any, @Param('caregiverId') caregiverId: string) {
    return this.service.revokeConsent(req.user.id, caregiverId);
  }

  @Get('caregivers')
  @ApiOperation({ summary: 'List all caregivers authorized by the current user' })
  async getCaregivers(@Request() req: any) {
    return this.service.getMyCaregivers(req.user.id);
  }

  @Get('patients')
  @ApiOperation({ summary: 'List all patients who have authorized the current user as a caregiver' })
  async getPatients(@Request() req: any) {
    return this.service.getMyPatients(req.user.id);
  }
}
