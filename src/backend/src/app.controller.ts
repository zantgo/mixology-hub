import {
  Controller,
  Get,
  Logger,
  Inject,
  Res,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import type { Response } from 'express';

@ApiTags('System')
@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Root health check' })
  getHello(): string {
    return 'Hello World!';
  }

  @Get('health')
  @ApiOperation({
    summary: 'Health check endpoint (DB + Redis + AI connectivity)',
  })
  async getHealth(@Res({ passthrough: true }) res: Response) {
    const checks: Record<string, string> = {};

    try {
      await this.dataSource.query('SELECT 1');
      checks.db = 'connected';
    } catch (err) {
      this.logger.error(`DB health check failed: ${(err as Error).message}`);
      checks.db = 'error';
    }

    try {
      await this.cacheManager.set('health_check', 'ok', 1000);
      const cached = await this.cacheManager.get('health_check');
      checks.redis = cached === 'ok' ? 'connected' : 'error';
    } catch (err) {
      this.logger.error(`Redis health check failed: ${(err as Error).message}`);
      checks.redis = 'error';
    }

    try {
      const aiUrl = this.configService.get<string>('AI_API_URL');
      const aiKey = this.configService.get<string>('AI_API_KEY');
      if (aiUrl && aiKey) {
        checks.ai_provider = 'configured';
      } else {
        checks.ai_provider = 'error';
      }
    } catch (err) {
      this.logger.error(`AI health check failed: ${(err as Error).message}`);
      checks.ai_provider = 'error';
    }

    const allHealthy = Object.values(checks).every(
      (v) => v === 'connected' || v === 'configured',
    );

    if (!allHealthy) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }

    return {
      status: allHealthy ? 'ok' : 'degraded',
      checks,
    };
  }
}
