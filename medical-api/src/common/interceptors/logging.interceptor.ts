import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, user } = request;
    const userEmail = user?.email || 'anonymous';

    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: (data: any) => {
          const duration = Date.now() - start;
          this.logger.debug(
            `${method} ${url} | User: ${userEmail} | ${duration}ms`,
          );
        },
        error: (error: any) => {
          const duration = Date.now() - start;
          this.logger.error(
            `${method} ${url} | User: ${userEmail} | ${duration}ms | Error: ${error.message}`,
          );
        },
      }),
    );
  }
}
