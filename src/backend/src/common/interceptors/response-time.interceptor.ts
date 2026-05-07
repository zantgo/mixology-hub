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
export class ResponseTimeInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ResponseTimeInterceptor.name);
  private readonly durations: number[] = [];
  private readonly MAX_WINDOW = 100;

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const start = Date.now();
    const request = context.switchToHttp().getRequest();

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - start;
        if (duration > 1000) {
          this.logger.warn({
            event: 'slow_request',
            method: request.method,
            url: request.url,
            durationMs: duration,
          });
        }

        this.durations.push(duration);
        if (this.durations.length > this.MAX_WINDOW) {
          this.durations.shift();
        }

        if (this.durations.length >= 2) {
          const sorted = [...this.durations].sort((a, b) => a - b);
          const p50 = sorted[Math.floor(sorted.length * 0.5)];
          const p95 = sorted[Math.floor(sorted.length * 0.95)];
          if (p95 > 500) {
            this.logger.warn({
              event: 'high_p95_latency',
              p50,
              p95,
              windowSize: this.durations.length,
            });
          }
        }
      }),
    );
  }
}
