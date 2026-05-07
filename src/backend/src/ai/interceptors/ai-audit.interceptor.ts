import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { AiToolAudit } from '../entities/ai-tool-audit.entity';

@Injectable()
export class AiAuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AiAuditInterceptor.name);

  constructor(
    @InjectRepository(AiToolAudit)
    private readonly auditRepository: Repository<AiToolAudit>,
    private readonly configService: ConfigService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const handler = context.getHandler();
    const controller = context.getClass();

    const toolName = `${controller.name}.${handler.name}`;
    const isWrite = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method);
    const userId = request.user?.id || null;
    const args = {
      body: this.sanitizeArgs(request.body),
      query: request.query,
      params: request.params,
    };

    const sampleRate = this.configService.get<number>(
      'AI_AUDIT_READ_SAMPLE_RATE',
      10,
    );

    const shouldAudit = isWrite || Math.random() * 100 < sampleRate;

    if (!shouldAudit) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(() => {
        this.saveAudit(toolName, args, 'success', isWrite, userId).catch(
          (err) =>
            this.logger.error(`Failed to save audit log: ${err.message}`),
        );
      }),
      catchError((error) => {
        this.saveAudit(toolName, args, 'error', isWrite, userId).catch((err) =>
          this.logger.error(`Failed to save audit log: ${err.message}`),
        );
        return throwError(() => error);
      }),
    );
  }

  private async saveAudit(
    toolName: string,
    args: Record<string, unknown>,
    status: 'success' | 'error',
    isWrite: boolean,
    userId: string | null,
  ): Promise<void> {
    const audit = this.auditRepository.create({
      toolName,
      arguments: args,
      resultStatus: status,
      isWrite,
      triggeredById: userId,
    });
    await this.auditRepository.save(audit);
  }

  private sanitizeArgs(body: any): Record<string, unknown> {
    if (!body) return {};
    const { password, passwordHash, refreshToken, accessToken, ...safe } = body;
    return safe;
  }
}
