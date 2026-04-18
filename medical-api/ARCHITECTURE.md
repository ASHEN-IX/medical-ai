# Backend Architecture - Design Decisions & Rationale

**Document Version:** 1.0  
**Date:** April 17, 2026  
**Status:** Production Ready

---

## 🎯 Executive Summary

MedAI Nexus backend is built with **clean architecture principles**, using **NestJS** as the framework with **PostgreSQL** for data persistence via **Prisma ORM**.

The system is designed to:
- Be **scalable** without monolithic coupling
- **Integrate cleanly** with Python AI service
- **Maintain data integrity** with proper relationships
- **Provide security** through JWT and role-based access
- **Enable auditing** with comprehensive logging

---

## 🏗️ Architecture Decision Records

### ADR-001: Framework Selection - NestJS

**Decision:** Use NestJS as the backend framework

**Rationale:**
- ✅ Built-in dependency injection (similar to Spring)
- ✅ Strong TypeScript support out of the box
- ✅ Modular architecture aligns with clean code principles
- ✅ Rich ecosystem (Passport, Swagger, Prisma integration)
- ✅ Active community and excellent documentation
- ✅ Enterprise-grade pattern support

**Alternatives Considered:**
- Express.js - Too minimal, requires manual structure
- FastAPI - Better for AI (chosen for Python service)
- Hapi - Overkill for REST API requirements
- Koa - Middleware-heavy, less structured

---

### ADR-002: Database & ORM - PostgreSQL + Prisma

**Decision:** Use PostgreSQL with Prisma ORM

**Rationale:**
- ✅ Prisma provides type-safe database access
- ✅ Zero-cost abstractions at runtime
- ✅ Auto-generated migrations
- ✅ Built-in soft delete patterns available
- ✅ PostgreSQL is production-proven for healthcare
- ✅ JSONB support for flexible data storage (predictions metadata)
- ✅ Strong transaction support

**Prisma Benefits Over Alternatives:**
| Feature | Prisma | TypeORM | Sequelize |
|---------|--------|---------|-----------|
| Type Safety | ★★★★★ | ★★★★☆ | ★★☆☆☆ |
| Migration Safety | ★★★★★ | ★★★☆☆ | ★★★☆☆ |
| Developer DX | ★★★★★ | ★★★★☆ | ★★★☆☆ |
| Documentation | ★★★★★ | ★★★★☆ | ★★★☆☆ |
| Query Builder | ★★★★☆ | ★★★☆☆ | ★★☆☆☆ |

---

### ADR-003: Authentication - JWT

**Decision:** Use JWT bearer tokens for stateless authentication

**Rationale:**
- ✅ Stateless - no session storage needed
- ✅ Scalable - works across multiple servers
- ✅ Microservice-friendly - shared secret validation
- ✅ Mobile-friendly - standard HTTP header
- ✅ Can be used by both frontend and mobile
- ✅ Refresh token support possible

**JWT Flow:**
```
1. User provides email/password
2. Backend validates and creates JWT
3. JWT contains user ID, email, expiration
4. Client stores JWT and sends in Authorization header
5. Backend validates signature and expiration
6. User identity extracted from token claims
```

**Security Measures:**
- Signed with strong secret
- 24-hour expiration
- Payload validation on every request
- No sensitive data in claims
- HTTPS required in production

---

### ADR-004: Role-Based Access Control (RBAC)

**Decision:** Implement decorator + guard pattern for RBAC

**Rationale:**
- ✅ Declarative syntax using decorators
- ✅ Composable with other guards
- ✅ Reusable across modules
- ✅ Easy to test
- ✅ Scalable to more roles

**Implementation:**
```typescript
@Roles(UserRole.DOCTOR, UserRole.ADMIN)
@UseGuards(AuthGuard('jwt'), RoleGuard)
async createPrediction() { }
```

**Roles Implemented:**
- **PATIENT** - Can upload reports, view own data
- **DOCTOR** - Can create predictions, view all reports
- **ADMIN** - Full system access, view logs

---

### ADR-005: Database Schema Design

**Decision:** Normalize data with clear relationships

**Rationale:**
- ✅ Data integrity through foreign keys
- ✅ Efficient queries with indexes
- ✅ ACID compliance
- ✅ Easy audit trails
- ✅ Supports future sharding

**Schema Highlights:**
```
User (1)
  ├── Many → MedicalReport
  ├── Many → Prediction
  └── Many → Log

MedicalReport (1)
  └── Many → Prediction

Prediction
  └── Relates to MedicalReport (Many-to-One)
```

**Key Design Decisions:**
- UUID primary keys - Distributed systems ready
- Cascading deletes - Clean data removal
- JSON fields - Flexible schema for predictions metadata
- Timestamps - Creation and update tracking
- Indexes - Performance optimization

---

### ADR-006: Error Handling Strategy

**Decision:** Centralized exception handling with HTTP filters

**Rationale:**
- ✅ Consistent error responses
- ✅ Security - no internal error leakage
- ✅ Easier debugging with structured logs
- ✅ User-friendly error messages

**Error Response Format:**
```json
{
  "statusCode": 400,
  "message": "User-friendly description",
  "timestamp": "2024-04-17T10:30:00Z"
}
```

**HTTP Status Codes Used:**
- `201` - Created successfully
- `204` - Deleted successfully
- `400` - Bad Request (validation failed)
- `401` - Unauthorized (no token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (duplicate email)
- `500` - Internal Server Error

---

### ADR-007: Logging Strategy

**Decision:** Structured logging at module level

**Rationale:**
- ✅ Debugging information without logging overhead
- ✅ Automatic timestamps
- ✅ Filterable by level (log, debug, warn, error)
- ✅ Ready for ELK/Sentry integration

**Logging Patterns:**
```typescript
// Info level - important business events
this.logger.log(`✅ Report created: ${report.id}`);

// Error level - failures
this.logger.error(`❌ Database error: ${error.message}`);

// Debug level - development info
this.logger.debug(`Database query: ${JSON.stringify(query)}`);
```

**Audit Trail via Database:**
- User logins logged in `Log` table
- Report uploads tracked
- Predictions recorded
- Admin actions traced

---

### ADR-008: Dependency Injection Pattern

**Decision:** Use NestJS IoC container with constructor injection

**Rationale:**
- ✅ Loose coupling between modules
- ✅ Testable - easy to mock dependencies
- ✅ Scalable - centralized configuration
- ✅ Industry standard in enterprise frameworks

**Pattern:**
```typescript
@Injectable()
export class FeatureService {
  constructor(private readonly prisma: PrismaService) {}
}
```

**Benefits:**
- Services don't create their own dependencies
- Easy to swap implementations
- Singleton pattern for shared services
- Lifecycle management by framework

---

### ADR-009: DTO Validation Strategy

**Decision:** Use class-validator with class-transformer

**Rationale:**
- ✅ Declarative validation rules
- ✅ Type-safe at compile time
- ✅ Runtime validation with clear errors
- ✅ Automatic type coercion

**Example:**
```typescript
export class CreateUserDto {
  @IsEmail()
  email: string;

  @MinLength(8)
  password: string;
}
```

**Validation Happens:**
- At controller entry point
- Global ValidationPipe configured
- Automatic error response on failure
- User-friendly error messages

---

### ADR-010: API Documentation

**Decision:** Use Swagger/OpenAPI with @nestjs/swagger

**Rationale:**
- ✅ Auto-generated from code decorators
- ✅ Interactive API explorer
- ✅ Always synchronized with code
- ✅ Standard OpenAPI format
- ✅ Can generate client SDKs

**Access:**
- Documentation: `http://localhost:3000/api/docs`
- Interactive testing available
- Real-time updates with code changes

---

## 🔐 Security Architecture

### Authentication Flow

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ POST /auth/login
       ▼
┌──────────────────────┐
│  Auth Controller     │
│ - Validate inputs    │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│  Auth Service        │
│ - Check credentials  │
│ - Hash comparison    │
│ - Generate JWT       │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│  JWT Token           │
│ {sub, email, exp}    │
└──────┬───────────────┘
       │
       ▼
┌─────────────┐
│   Client    │ Stores JWT
└─────────────┘
```

### Protected Request Flow

```
┌─────────────┐
│   Client    │ Sends: Authorization: Bearer <JWT>
└──────┬──────┘
       │
       ▼
┌──────────────────────┐
│  AuthGuard (JWT)     │
│ - Extract token      │
│ - Verify signature   │
│ - Check expiration   │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│  JWT Strategy        │
│ - Decode payload     │
│ - Fetch user         │
│ - Attach to request  │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│  RoleGuard (RBAC)    │
│ - Check user role    │
│ - Verify endpoint    │
│ - Allow/Deny access  │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│  Controller Handler  │
│ - Process request    │
│ - Return response    │
└──────────────────────┘
```

---

## 📊 Data Flow Architecture

### Report Upload Flow

```
Frontend
   │ (File metadata)
   ▼
Reports Controller
   │ ✓ Auth check
   │ ✓ Validation
   ▼
Reports Service
   │ ✓ Create record
   │ ✓ Generate ID
   ▼
Prisma Client
   │ (Type-safe query)
   ▼
PostgreSQL Database
   │ Store in MedicalReport table
   ▼
Success Response
```

### Prediction Flow (Ready for AI Integration)

```
Doctor Frontend
   │ (Prediction data)
   ▼
Predictions Controller
   │ ✓ Auth + RBAC check
   │ ✓ Validation
   ▼
Predictions Service
   │ ✓ Create prediction
   │ ✓ Log action
   ▼
Prisma Client
   │ (Type-safe query)
   ▼
PostgreSQL Database
   │ Store in Prediction table
   ▼
✅ Ready for AI Service Integration!
```

---

## 🚀 Scalability Considerations

### Horizontal Scaling Ready

**Stateless Design:**
- No server-side sessions
- JWT tokens sufficient for auth
- Any instance can handle any request
- Load balancer friendly

**Database:**
- Connection pooling via Prisma
- Indexes for query performance
- Ready for replication
- UUID PKs support distributed systems

### Vertical Scaling

**Code Patterns:**
- Services can use caching
- Lazy loading with Prisma
- Pagination implemented
- Selective field queries

### Future Microservices

**Module Independence:**
- Each module can be extracted
- Clear boundaries between services
- REST communication ready
- Message queue compatible

---

## 🔄 Integration Architecture

### Current State

```
┌─────────────┐
│  Frontend   │
│  (Next.js)  │
└──────┬──────┘
       │ REST
       ▼
┌─────────────────┐
│  Backend        │
│  (NestJS)       │
└────────┬────────┘
         │ SQL
         ▼
    PostgreSQL
```

### Future Integration (Phase 2)

```
┌─────────────┐
│  Frontend   │
│  (Next.js)  │
└──────┬──────┘
       │ REST
       ▼
┌─────────────────┐
│  Backend        │ ◄────┐
│  (NestJS)       │      │ Webhooks
└────────┬────────┘      │
         │ SQL           │
         ▼               │
    PostgreSQL      ┌────┴──────┐
                    │ AI Service│
                    │(Python)   │
                    └────┬──────┘
                         │
                    ┌────┴───────┐
                    │ LLMs, RAG  │
                    │ Knowledge  │
                    └────────────┘
```

---

## 📈 Performance Optimization

### Database Queries
- Indexes on frequently searched fields
- Selective field queries (no `SELECT *`)
- Relationships with `include` instead of N+1
- Pagination in list endpoints

### Caching Strategy (Future)
- JWT validation caching
- User role caching
- Frequently accessed reports
- Prediction results caching

### Monitoring Points
- Request latency
- Database query time
- Error rates
- User authentication success rate

---

## 🛡️ Security Layers

### Layer 1: Transport
- HTTPS only in production
- TLS 1.3+
- Certificate validation

### Layer 2: Authentication
- JWT tokens
- Password hashing (bcrypt)
- Token expiration
- Secure secret storage

### Layer 3: Authorization
- Role-based access control
- Endpoint-level guards
- Resource-level ownership checks

### Layer 4: Input Validation
- DTO validation
- Type checking
- Range validation
- SQL injection prevention (Prisma)

### Layer 5: Output
- Error message sanitization
- No internal error leakage
- Consistent response format

---

## 🔄 Deployment Architecture

### Development
```
npm/pnpm
   ↓
TypeScript → JavaScript
   ↓
Hot reload server
   ↓
Local PostgreSQL
```

### Production
```
Docker Container
   ├── NestJS compiled code
   ├── Node runtime
   └── Environment config

Docker Compose / Kubernetes
   ├── Health checks
   ├── Load balancing
   ├── Auto-restart
   └── Environment secrets
```

---

## 📚 Clean Architecture Principles Applied

### ✅ Dependency Inversion
- Controllers depend on Services (abstraction)
- Services depend on PrismaService (abstraction)
- Not on concrete implementations

### ✅ Single Responsibility
- Controllers handle HTTP
- Services handle business logic
- Prisma handles data access

### ✅ Open/Closed Principle
- Open for extension (new modules)
- Closed for modification (established patterns)

### ✅ Interface Segregation
- DTOs for specific operations
- Guards for specific needs
- Modules for specific features

### ✅ Liskov Substitution
- Guards are interchangeable
- Services follow same pattern
- Controllers follow same pattern

---

## 🎓 Learning Path for New Developers

1. **Understand NestJS Basics**
   - Controllers and Services
   - Dependency Injection
   - Modules

2. **Learn Database Layer**
   - Prisma schema
   - Migrations
   - Relationships

3. **Implement a Simple CRUD Module**
   - Using the MODULE_TEMPLATE.md
   - Follow established patterns
   - Test locally

4. **Understand Authentication**
   - JWT concepts
   - Guards and Decorators
   - Role-based access

5. **Study Existing Modules**
   - Auth module (JWT patterns)
   - Reports module (CRUD patterns)
   - Logs module (audit patterns)

---

## 🚀 Future Evolution

### Phase 2: AI Integration
- [ ] Python FastAPI service integration
- [ ] Prediction job queuing
- [ ] Webhook handling for AI results
- [ ] Embedding storage

### Phase 3: Advanced Features
- [ ] GraphQL layer
- [ ] Real-time updates (WebSocket)
- [ ] Advanced search (Elasticsearch)
- [ ] Caching layer (Redis)

### Phase 4: Enterprise
- [ ] Multi-tenancy support
- [ ] Advanced audit logging
- [ ] Compliance features (HIPAA)
- [ ] Backup and disaster recovery

---

## 📖 References

- [NestJS Documentation](https://docs.nestjs.com)
- [Prisma Documentation](https://www.prisma.io/docs)
- [PostgreSQL Best Practices](https://www.postgresql.org/docs)
- [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [SOLID Principles](https://en.wikipedia.org/wiki/SOLID)

---

**Document Maintained By:** Backend Team  
**Last Updated:** April 17, 2026  
**Review Frequency:** Every new major feature
