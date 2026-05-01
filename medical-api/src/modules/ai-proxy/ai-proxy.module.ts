import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AiProxyService } from './ai-proxy.service';
import { AiProxyController } from './ai-proxy.controller';

@Module({
  imports: [PrismaModule],
  providers: [AiProxyService],
  controllers: [AiProxyController],
  exports: [AiProxyService],
})
export class AiProxyModule {}
