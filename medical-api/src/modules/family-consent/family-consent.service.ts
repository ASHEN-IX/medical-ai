import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FamilyConsentService {
  constructor(private readonly prisma: PrismaService) {}

  async grantConsent(patientId: string, caregiverId: string, accessLevel: string, expiresAt?: Date) {
    // Check if caregiver exists
    const caregiver = await this.prisma.user.findUnique({ where: { id: caregiverId } });
    if (!caregiver) throw new NotFoundException('Caregiver not found');

    const scope = this.normalizeScope(accessLevel);

    return this.prisma.familyConsent.upsert({
      where: {
        patientId_caregiverId: { patientId, caregiverId },
      },
      update: {
        scope,
        isActive: true,
        expiresAt: expiresAt || null,
      },
      create: {
        patientId,
        caregiverId,
        scope,
        isActive: true,
        expiresAt: expiresAt || null,
      },
    });
  }

  async revokeConsent(patientId: string, caregiverId: string) {
    return this.prisma.familyConsent.update({
      where: {
        patientId_caregiverId: { patientId, caregiverId },
      },
      data: {
        isActive: false,
      },
    });
  }

  async getMyCaregivers(patientId: string) {
    return this.prisma.familyConsent.findMany({
      where: { patientId, isActive: true },
      include: { caregiver: { select: { id: true, name: true, email: true } } },
    });
  }

  async getMyPatients(caregiverId: string) {
    return this.prisma.familyConsent.findMany({
      where: { caregiverId, isActive: true },
      include: { patient: { select: { id: true, name: true, email: true } } },
    });
  }

  async checkAccess(patientId: string, caregiverId: string) {
    const consent = await this.prisma.familyConsent.findUnique({
      where: { patientId_caregiverId: { patientId, caregiverId } },
    });

    if (!consent || !consent.isActive) return false;
    if (consent.expiresAt && consent.expiresAt < new Date()) return false;

    return true;
  }

  private normalizeScope(accessLevel: string) {
    const normalized = accessLevel?.toUpperCase();
    if (normalized === 'FULL_ACCESS' || normalized === 'EMERGENCY_ONLY' || normalized === 'READ_ONLY') {
      return normalized as 'FULL_ACCESS' | 'EMERGENCY_ONLY' | 'READ_ONLY';
    }
    throw new BadRequestException('Invalid access level');
  }
}
