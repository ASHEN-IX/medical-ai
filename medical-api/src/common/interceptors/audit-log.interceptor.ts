import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../../prisma/prisma.service';
import { AUDIT_LOG_KEY, AuditLogOptions } from '../decorators/audit-log.decorator';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const options = this.reflector.getAllAndOverride<AuditLogOptions>(AUDIT_LOG_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!options) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const { resource, action, targetIdSource, targetIdKey } = options;

    let targetId = null;
    if (targetIdSource && targetIdKey) {
      targetId = request[targetIdSource][targetIdKey];
    }

    return next.handle().pipe(
      tap(async () => {
        try {
          await this.prisma.auditLog.create({
            data: {
              actorId: user?.id || 'ANONYMOUS',
              targetId: targetId || null,
              resource,
              action,
              ipAddress: request.ip,
              details: {
                method: request.method,
                url: request.url,
                params: request.params,
                query: request.query,
                // Avoid logging sensitive body data like passwords
              },
            },
          });
        } catch (err) {
          this.logger.error('Failed to create audit log', err);
        }
      }),
    );
  }
}
