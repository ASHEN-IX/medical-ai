import { Module } from '@nestjs/common';
import { CommunicationsGateway } from './communications.gateway';
import { MessagesModule } from '../messages/messages.module';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [MessagesModule, PrismaModule],
  providers: [CommunicationsGateway],
  exports: [CommunicationsGateway],
})
export class CommunicationsModule {}
