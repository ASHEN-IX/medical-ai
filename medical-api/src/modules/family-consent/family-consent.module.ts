import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { FamilyConsentService } from './family-consent.service';
import { FamilyConsentController } from './family-consent.controller';

@Module({
  imports: [PrismaModule],
  providers: [FamilyConsentService],
  controllers: [FamilyConsentController],
  exports: [FamilyConsentService],
})
export class FamilyConsentModule {}
