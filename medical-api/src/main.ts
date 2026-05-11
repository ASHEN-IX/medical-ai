import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  // Security: Use helmet for HTTP headers
  app.use(helmet());

  // CORS configuration
  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  });

  // Global validation pipe with DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
        exposeDefaultValues: true,
        exposeUnsetFields: false,
      },
    }),
  );

  // Swagger/OpenAPI documentation
  const config = new DocumentBuilder()
    .setTitle('MedAI Nexus Backend')
    .setDescription('Production-grade healthcare AI platform backend API')
    .setVersion('1.0.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'JWT',
    )
    .addTag('auth', 'Authentication endpoints')
    .addTag('users', 'User management endpoints')
    .addTag('reports', 'Medical reports endpoints')
    .addTag('predictions', 'AI predictions endpoints')
    .addTag('analyses', 'Analysis results endpoints')
    .addTag('ai', 'AI proxy and health timeline endpoints')
    .addTag('doctor-requests', 'Patient-to-doctor request endpoints')
    .addTag('doctor-reviews', 'Doctor review and feedback endpoints')
    .addTag('messages', 'Doctor-patient messaging endpoints')
    .addTag('logs', 'System audit logs endpoints')
    .addTag('case-assignments', 'Specialist case assignment endpoints')
    .addTag('appointments', 'Appointment management endpoints')
    .addTag('alerts', 'Smart alerts and notifications')
    .addTag('manual-tests', 'Manual disease testing endpoints')
    .addTag('prescriptions', 'Prescription and medication management')
    .addTag('transportation', 'Transportation booking endpoints')
    .addTag('prevention-plans', 'Personalized prevention plans')
    .addTag('consultation-history', 'Unified consultation timeline')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);

  logger.log(`✅ MedAI Nexus Backend running on http://localhost:${port}`);
  logger.log(`📚 API Documentation: http://localhost:${port}/api/docs`);
}

bootstrap().catch((err) => {
  console.error('❌ Failed to start application:', err);
  process.exit(1);
});
