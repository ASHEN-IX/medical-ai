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
import { MetricsModule } from './modules/metrics/metrics.module';

// --- New modules ---
import { CaseAssignmentsModule } from './modules/case-assignments/case-assignments.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { ManualTestsModule } from './modules/manual-tests/manual-tests.module';
import { PrescriptionsModule } from './modules/prescriptions/prescriptions.module';
import { TransportationModule } from './modules/transportation/transportation.module';
import { PreventionPlansModule } from './modules/prevention-plans/prevention-plans.module';
import { ConsultationHistoryModule } from './modules/consultation-history/consultation-history.module';
import { CommunicationsModule } from './modules/communications/communications.module';
import { FamilyConsentModule } from './modules/family-consent/family-consent.module';
import { MonitoringModule } from './modules/monitoring/monitoring.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { HealthMetricsModule } from './modules/health-metrics/health-metrics.module';
import { MedicationsModule } from './modules/medications/medications.module';
import { DynamicQuestionsModule } from './modules/dynamic-questions/dynamic-questions.module';

// --- Compliance & Security ---
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';

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
    MetricsModule,
    // --- New modules ---
    CaseAssignmentsModule,
    AppointmentsModule,
    AlertsModule,
    ManualTestsModule,
    PrescriptionsModule,
    TransportationModule,
    PreventionPlansModule,
    ConsultationHistoryModule,
    CommunicationsModule,
    FamilyConsentModule,
    MonitoringModule,
    NotificationsModule,
    HealthMetricsModule,
    MedicationsModule,
    DynamicQuestionsModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor,
    },
  ],
})
export class AppModule {}
