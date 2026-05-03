import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private readonly connectAttempts = 5;
  private readonly connectDelayMs = 1500;

  async onModuleInit() {
    let lastError: unknown;

    for (let attempt = 1; attempt <= this.connectAttempts; attempt += 1) {
      try {
        await this.$connect();
        this.logger.log('✅ Database connection established');
        return;
      } catch (error) {
        lastError = error;
        this.logger.warn(
          `⚠️ Database connection attempt ${attempt}/${this.connectAttempts} failed, retrying...`,
        );

        if (attempt < this.connectAttempts) {
          await new Promise((resolve) => setTimeout(resolve, this.connectDelayMs * attempt));
        }
      }
    }

    this.logger.error('❌ Failed to connect to database after retries:', lastError);
    throw lastError as Error;
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
