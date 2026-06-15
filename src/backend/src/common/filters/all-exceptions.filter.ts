import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);
  private readonly MAX_LOG_LENGTH = 4096;

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.message
        : 'Internal server error';

    const logPayload: Record<string, unknown> = {
      path: request.url,
      method: request.method,
      timestamp: new Date().toISOString(),
      statusCode: status,
      exception:
        exception instanceof Error
          ? {
              name: exception.name,
              message: exception.message,
              stack: this.truncate(exception.stack),
            }
          : exception,
    };

    this.logger.error('Unhandled exception', logPayload);

    // Error alerting hook: log 5xx errors with structured metadata for
    // external monitoring systems (Datadog, Sentry, etc.) to pick up.
    if (status >= 500) {
      this.logger.error({
        event: 'server_error',
        path: request.url,
        method: request.method,
        statusCode: status,
        timestamp: new Date().toISOString(),
        alert: true,
      });
    }

    response.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  private truncate(value: unknown): string {
    const str =
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      typeof value === 'string' ? value : value == null ? '' : String(value);
    return str.length > this.MAX_LOG_LENGTH
      ? str.substring(0, this.MAX_LOG_LENGTH) + '...[truncated]'
      : str;
  }
}
