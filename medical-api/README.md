# MedAI Nexus Backend API

> Production-grade NestJS backend for healthcare AI platform

## 📋 Overview

This is the **core API service** for MedAI Nexus. It provides:

- ✅ RESTful API with JWT authentication
- ✅ User management (Patient, Doctor, Admin roles)
- ✅ Medical report upload & metadata storage
- ✅ AI prediction storage & retrieval
- ✅ System audit logging
- ✅ Clean scalable architecture
- ✅ PostgreSQL database with Prisma ORM
- ✅ Production-ready error handling

## 🏗️ Architecture

### Project Structure

```
src/
├── main.ts                 # Application entry point
├── app.module.ts          # Root NestJS module
│
├── config/                # Configuration management
├── prisma/                # Database service
│
├── common/                # Shared utilities
│   ├── guards/            # JWT, Role guards
│   ├── decorators/        # Role decorator
│   ├── filters/           # HTTP exception filter
│   └── interceptors/      # Logging interceptor
│
└── modules/
    ├── auth/              # Authentication & JWT
    ├── users/             # User management
    ├── reports/           # Medical reports
    ├── predictions/       # AI predictions
    └── logs/              # Audit logging
```

### Module Responsibilities

| Module | Purpose |
|--------|---------|
| **Auth** | JWT tokens, registration, login |
| **Users** | User profiles, role management |
| **Reports** | Medical file metadata, storage |
| **Predictions** | AI results storage (placeholder for AI integration) |
| **Logs** | Audit trail for compliance |

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ or Docker
- PostgreSQL 14+
- pnpm (or npm)

### 1. Environment Setup

```bash
cp .env.example .env
# Edit .env with your database credentials
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Setup Database

```bash
# Generate Prisma client
pnpm prisma:generate

# Run migrations
pnpm prisma:migrate:dev --name "init"

# Seed sample data
pnpm prisma:seed
```

### 4. Start Development Server

```bash
pnpm start:dev
```

Server runs on `http://localhost:3000`
API docs: `http://localhost:3000/api/docs`

## 🐳 Docker Setup

```bash
# Using docker-compose from root
cd ..
docker-compose up -d

# Inside container
docker-compose exec medical-api bash
pnpm prisma:migrate:dev
pnpm prisma:seed
```

## 📚 API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register new user |
| POST | `/auth/login` | Login with credentials |
| GET | `/auth/profile` | Get current user (JWT required) |

### Users

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/users/me` | Get current user profile |
| GET | `/users/:id` | Get user by ID (Doctor/Admin) |
| PATCH | `/users/:id` | Update user profile |
| GET | `/users` | List all users (Admin only) |

### Reports

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/reports` | Upload report metadata |
| GET | `/reports/my-reports` | Get user's reports |
| GET | `/reports/:id` | Get report details |
| DELETE | `/reports/:id` | Delete report |

### Predictions

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/predictions` | Create prediction (Doctor/Admin) |
| GET | `/predictions/report/:reportId` | Get predictions for report |
| GET | `/predictions/:id` | Get prediction details |

### Logs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/logs` | Get all logs (Admin only) |
| GET | `/logs/user/:userId` | Get user logs |
| GET | `/logs/action/:action` | Get logs by action |
| GET | `/logs/recent?hours=24` | Get recent logs |

## 🔐 Authentication

All protected endpoints require JWT bearer token:

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" http://localhost:3000/users/me
```

### Getting a Token

1. Register:
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "password123"
  }'
```

2. Login:
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123"
  }'
```

Response includes `accessToken` to use in requests.

## 👤 User Roles

- **PATIENT**: Can upload reports, view own data
- **DOCTOR**: Can view all reports, create predictions
- **ADMIN**: Full system access, view logs

## 🗄️ Database Schema

### User
- id (UUID)
- name, email, password
- role (PATIENT, DOCTOR, ADMIN)
- createdAt, updatedAt

### MedicalReport
- id (UUID), userId (FK)
- fileUrl, fileName
- extractedData (JSON)
- createdAt, updatedAt

### Prediction
- id (UUID), reportId (FK), userId (FK)
- disease, confidence
- explanation, metadata (JSON)
- createdAt, updatedAt

### Log
- id (UUID), userId (optional FK)
- action, metadata (JSON)
- createdAt

## 📝 Development

### Code Quality

```bash
# Format code
pnpm format

# Lint
pnpm lint

# Tests
pnpm test                # Unit tests
pnpm test:watch         # Watch mode
pnpm test:e2e           # End-to-end tests
pnpm test:cov           # Coverage report
```

### Database

```bash
# View data in UI
pnpm prisma:studio

# Create migration
pnpm prisma:migrate:dev --name "description"

# Reset database (CAUTION: deletes data)
pnpm prisma:migrate:reset
```

## 🧪 Test Users (After Seeding)

- **Admin**: admin@medai.local / admin123
- **Doctor**: doctor@medai.local / doctor123
- **Patient**: patient@medai.local / patient123

## 🔑 Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/medai_nexus

# JWT
JWT_SECRET=your-secret-key

# Server
PORT=3000
NODE_ENV=development

# CORS
CORS_ORIGIN=*
```

## 🚨 Error Handling

Standard HTTP status codes:

- `400`: Bad Request (validation error)
- `401`: Unauthorized (missing/invalid token)
- `403`: Forbidden (insufficient permissions)
- `404`: Not Found
- `409`: Conflict (duplicate email)
- `500`: Internal Server Error

Error response format:

```json
{
  "statusCode": 400,
  "message": "Error description",
  "timestamp": "2024-04-17T10:30:00Z"
}
```

## 📚 Documentation

- Swagger/OpenAPI: `http://localhost:3000/api/docs`
- Architecture decisions: [ARCHITECTURE.md](../ARCHITECTURE.md)
- Development guide: [DEVELOPMENT.md](../DEVELOPMENT.md)

## 🔄 Integration Points

### Ready to Connect To:
- **Python AI Service**: Receives predictions via POST
- **PostgreSQL Database**: Data persistence
- **Frontend (Next.js)**: Medical Web UI

### Future Integration:
- Vector database for embeddings
- Neo4j for knowledge graph
- S3 for file storage
- Message queue for async processing

## 📦 Dependencies

- `@nestjs/core@^10.2.0` - NestJS framework
- `@prisma/client@^5.5.0` - ORM
- `passport-jwt@^4.0.1` - JWT auth
- `bcrypt@^5.1.0` - Password hashing
- `class-validator@^0.14.0` - DTO validation

## 🛠️ Production Deployment

```bash
# Build
pnpm build

# Start production server
pnpm start:prod

# With environment
NODE_ENV=production PORT=3000 node dist/main.js
```

### Pre-deployment Checklist

- [ ] Set strong JWT_SECRET
- [ ] Configure DATABASE_URL for production
- [ ] Enable HTTPS
- [ ] Configure CORS_ORIGIN properly
- [ ] Set up monitoring/logging
- [ ] Run database migrations
- [ ] Set NODE_ENV=production

## 📄 License

MIT - See LICENSE file

## 👥 Team

MedAI Nexus Development Team
│   ├── app.controller.ts  # Root controller
│   ├── app.service.ts     # Root service
│   │
│   ├── auth/              # Authentication module
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── auth.module.ts
│   │   ├── dto/
│   │   │   ├── login.dto.ts
│   │   │   ├── register.dto.ts
│   │   │   └── refresh.dto.ts
│   │   ├── strategies/
│   │   │   ├── jwt.strategy.ts
│   │   │   └── local.strategy.ts
│   │   └── guards/
│   │       └── jwt-auth.guard.ts
│   │
│   ├── users/             # Users module
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   ├── users.module.ts
│   │   ├── dto/
│   │   │   └── update-user.dto.ts
│   │   └── entities/
│   │       └── user.entity.ts
│   │
│   ├── reports/           # Medical reports module
│   │   ├── reports.controller.ts
│   │   ├── reports.service.ts
│   │   ├── reports.module.ts
│   │   ├── dto/
│   │   │   └── create-report.dto.ts
│   │   ├── entities/
│   │   │   └── report.entity.ts
│   │   └── upload/        # File upload handlers
│   │       ├── file.interceptor.ts
│   │       └── storage.service.ts
│   │
│   ├── analysis/          # Analysis orchestration
│   │   ├── analysis.controller.ts
│   │   ├── analysis.service.ts
│   │   ├── analysis.module.ts
│   │   ├── client/
│   │   │   └── ai-service.client.ts  # Python service HTTP client
│   │   ├── dto/
│   │   │   └── analyze.dto.ts
│   │   └── job/
│   │       ├── job.queue.ts
│   │       └── job.processor.ts
│   │
│   ├── common/            # Shared utilities
│   │   ├── filters/
│   │   │   └── http-exception.filter.ts
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts
│   │   │   └── roles.guard.ts
│   │   ├── interceptors/
│   │   │   ├── logging.interceptor.ts
│   │   │   └── response.interceptor.ts
│   │   ├── middlewares/
│   │   │   └── request-logger.middleware.ts
│   │   ├── decorators/
│   │   │   ├── current-user.decorator.ts
│   │   │   └── roles.decorator.ts
│   │   ├── pipes/
│   │   │   └── validation.pipe.ts
│   │   └── utils/
│   │       └── hash.util.ts
│   │
│   ├── config/            # Configuration
│   │   ├── database.config.ts
│   │   ├── ai-service.config.ts
│   │   ├── jwt.config.ts
│   │   └── env.validation.ts
│   │
│   ├── health/            # Health check
│   │   ├── health.controller.ts
│   │   └── health.service.ts
│   │
│   └── __tests__/         # Test files
│       ├── auth.e2e.spec.ts
│       ├── reports.e2e.spec.ts
│       └── analysis.e2e.spec.ts
│
├── test/
│   ├── jest.config.js
│   └── setup.ts
│
├── .env.local            # Local environment (gitignored)
├── .env.example          # Example environment
├── package.json
├── tsconfig.json         # TypeScript config
├── nest-cli.json         # NestJS config
├── Dockerfile.backend    # Docker image
└── README.md            # This file
```

## 🚀 Development Setup

### Prerequisites
- Node.js 20+
- pnpm
- PostgreSQL 15+ (or Docker)
- Neo4j (or Docker)

### Local Development
```bash
# Install dependencies
pnpm install

# Setup environment
cp .env.example .env.local

# Setup database
pnpm prisma:migrate:dev

# Start dev server
pnpm start:dev

# API runs on http://localhost:4000
```

### Environment Variables
```bash
# .env.local
NODE_ENV=development
PORT=4000

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/medai

# JWT
JWT_SECRET=dev-secret-key-CHANGE-IN-PRODUCTION
JWT_EXPIRATION=3600

# Neo4j
NEO4J_URL=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=password

# AI Service
AI_SERVICE_URL=http://localhost:8001
AI_SERVICE_TIMEOUT_MS=120000

# Redis
REDIS_URL=redis://localhost:6379

# Storage
STORAGE_TYPE=local
STORAGE_PATH=/uploads
```

## 📦 Key Dependencies

```json
{
  "dependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/core": "^10.0.0",
    "@nestjs/jwt": "^12.0.0",
    "@nestjs/passport": "^10.0.0",
    "@prisma/client": "^5.0.0",
    "axios": "^1.6.0",
    "passport-jwt": "^4.0.1",
    "bcrypt": "^5.1.0",
    "class-validator": "^0.14.0",
    "uuid": "^9.0.0"
  }
}
```

## 🔧 Common Development Tasks

### Creating a New Module

```bash
# Generate module scaffold
nest g module modules/my-module

# This creates:
# - my-module.module.ts
# - my-module.service.ts
# - my-module.controller.ts
```

### Creating Database Schema

```typescript
// prisma/schema.prisma
model Report {
  id    String  @id @default(cuid())
  userId String
  user  User    @relation(fields: [userId], references: [id])
  fileName String
  fileType String
  fileSize Int
  status String  @default("PENDING")
  predictions Prediction[]
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@index([userId])
  @@index([status])
}
```

### Running Migrations

```bash
# Create migration
pnpm prisma:migrate:dev --name "add_reports_table"

# View database with Prisma Studio
pnpm prisma:studio

# Deploy migration (production)
pnpm prisma:migrate:deploy

# Seed database
pnpm prisma:seed
```

### Creating a Controller Endpoint

```typescript
// reports.controller.ts
import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';

@Controller('reports')
@UseGuards(AuthGuard('jwt'))
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Post('upload')
  async uploadReport(
    @Body() createReportDto: CreateReportDto,
    @Req() req: Request & { user: any },
  ) {
    return this.reportsService.createReport(
      req.user.id,
      createReportDto,
    );
  }
}
```

### Creating a Service

```typescript
// reports.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async createReport(userId: string, data: CreateReportDto) {
    return this.prisma.report.create({
      data: {
        userId,
        fileName: data.fileName,
        fileType: data.fileType,
        fileSize: data.fileSize,
      },
    });
  }
}
```

### Authentication with JWT

```typescript
// auth.service.ts
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user || !await bcrypt.compare(password, user.passwordHash)) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = this.jwt.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    return { accessToken: token };
  }
}
```

### Calling AI Service

```typescript
// analysis.service.ts
import { Injectable, HttpException } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class AnalysisService {
  private aiServiceUrl = process.env.AI_SERVICE_URL;
  private timeout = parseInt(process.env.AI_SERVICE_TIMEOUT_MS || '120000');

  async analyzeReport(reportPath: string, reportId: string) {
    try {
      const response = await axios.post(
        `${this.aiServiceUrl}/predict`,
        {
          reportPath,
          reportId,
        },
        { timeout: this.timeout },
      );

      return response.data;
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        throw new HttpException(
          'AI Service unavailable',
          503,
        );
      }
      throw error;
    }
  }
}
```

## ✅ Testing

### Running Tests
```bash
# Run unit tests
pnpm test

# Run E2E tests
pnpm test:e2e

# Watch mode
pnpm test:watch

# Coverage
pnpm test:cov
```

### Example Unit Test
```typescript
// auth.service.spec.ts
import { Test } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should throw on invalid credentials', async () => {
    jest.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(null);

    expect(
      service.login('user@example.com', 'password'),
    ).rejects.toThrow();
  });
});
```

### Example E2E Test
```typescript
// auth.e2e.spec.ts
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Authentication (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('POST /auth/login', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123',
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('accessToken');
  });

  afterAll(async () => {
    await app.close();
  });
});
```

## 🔐 Security Best Practices

### Password Hashing
```typescript
import * as bcrypt from 'bcrypt';

// Hash password before storing
const hashed = await bcrypt.hash(password, 10);

// Compare on login
const isValid = await bcrypt.compare(password, user.passwordHash);
```

### JWT Configuration
```typescript
// config/jwt.config.ts
export const jwtConfig = {
  secret: process.env.JWT_SECRET,
  expiresIn: process.env.JWT_EXPIRATION || '1h',
  algorithm: 'HS256',
};
```

### Input Validation
```typescript
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}
```

### Role-Based Access Control
```typescript
// common/decorators/roles.decorator.ts
export const Roles = (...roles: string[]) => SetMetadata('roles', roles);

// common/guards/roles.guard.ts
@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>(
      'roles',
      context.getHandler(),
    );
    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.some((role) => user.role === role);
  }
}

// Usage in controller
@Post('admin-only')
@Roles('ADMIN')
@UseGuards(RolesGuard)
adminAction() {
  // Only accessible to ADMIN role
}
```

## 📊 Error Handling

### Global Exception Filter
```typescript
// common/filters/http-exception.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
} from '@nestjs/common';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const status = exception.getStatus();

    response.status(status).json({
      statusCode: status,
      message: exception.getResponse(),
      timestamp: new Date().toISOString(),
    });
  }
}

// Register in main.ts
app.useGlobalFilters(new HttpExceptionFilter());
```

## 📚 API Response Format

### Success Response
```json
{
  "statusCode": 200,
  "data": { ... },
  "message": "Success",
  "timestamp": "2026-04-17T10:30:00Z"
}
```

### Error Response
```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Invalid input",
  "timestamp": "2026-04-17T10:30:00Z"
}
```

## 🚀 Production Build

```bash
# Build
pnpm build

# Start production server
NODE_ENV=production pnpm start:prod
```

## 🐛 Troubleshooting

### Database Connection Error
```bash
# Check PostgreSQL is running
docker-compose ps | grep postgres

# Check connection string in .env.local
# Format: postgresql://user:password@localhost:5432/medai

# Test connection
psql postgresql://user:password@localhost:5432/medai
```

### Migration Issues
```bash
# Reset database (WARNING: deletes all data)
pnpm prisma:migrate:reset --force

# View migration status
pnpm prisma:migrate:status
```

### Port Already in Use
```bash
# Use different port
PORT=4001 pnpm start:dev
```

## 📝 Code Style

- **Language:** TypeScript
- **Format:** Prettier
- **Linting:** ESLint
- **Module Pattern:** NestJS modules
- **Naming:** PascalCase for classes, camelCase for functions
- **File Naming:** kebab-case (my-module.ts)

## 🔄 Development Workflow

1. Create feature branch from `main`
2. Create NestJS module with `nest g`
3. Update Prisma schema if needed
4. Run migrations: `pnpm prisma:migrate:dev`
5. Implement controller, service, DTOs
6. Write tests
7. Test with `pnpm test:e2e`
8. Submit PR for review

## 📚 Resources

- [NestJS Documentation](https://docs.nestjs.com)
- [Prisma Documentation](https://www.prisma.io/docs)
- [PostgreSQL](https://www.postgresql.org/docs)
- [JWT Authentication](https://jwt.io)
- [TypeScript](https://www.typescriptlang.org/docs)

---

**Part of MedAI Nexus Platform**  
See [../ARCHITECTURE.md](../ARCHITECTURE.md) for full system design.
