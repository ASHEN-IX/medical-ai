import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ReportsModule } from './modules/reports/reports.module';
import { PredictionsModule } from './modules/predictions/predictions.module';
import { AnalysesModule } from './modules/analyses/analyses.module';
import { LogsModule } from './modules/logs/logs.module';
import { AiProxyModule } from './modules/ai-proxy/ai-proxy.module';
import { DoctorRequestsModule } from './modules/doctor-requests/doctor-requests.module';
import { DoctorReviewsModule } from './modules/doctor-reviews/doctor-reviews.module';
import { MessagesModule } from './modules/messages/messages.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    ReportsModule,
    PredictionsModule,
    AnalysesModule,
    LogsModule,
    AiProxyModule,
    DoctorRequestsModule,
    DoctorReviewsModule,
    MessagesModule,
  ],
})
export class AppModule {}
