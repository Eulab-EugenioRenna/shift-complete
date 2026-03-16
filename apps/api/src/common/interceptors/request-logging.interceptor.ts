import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { randomUUID } from 'node:crypto';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RequestLoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{
      method: string;
      url: string;
      headers: Record<string, string | string[] | undefined>;
      requestId?: string;
      user?: { sub?: string; role?: string };
    }>();
    const response = context.switchToHttp().getResponse<{ setHeader: (name: string, value: string) => void; statusCode: number }>();
    const startedAt = Date.now();
    const requestId = request.headers['x-request-id']?.toString() ?? randomUUID();

    request.requestId = requestId;
    response.setHeader('x-request-id', requestId);

    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.log(
            `${request.method} ${request.url} -> ${response.statusCode} ${Date.now() - startedAt}ms [${requestId}] actor=${request.user?.sub ?? 'anonymous'} role=${request.user?.role ?? 'public'}`
          );
        },
        error: () => {
          this.logger.warn(
            `${request.method} ${request.url} -> ${response.statusCode} ${Date.now() - startedAt}ms [${requestId}] actor=${request.user?.sub ?? 'anonymous'} role=${request.user?.role ?? 'public'}`
          );
        }
      })
    );
  }
}
