import { Controller, Get, Logger, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AppService } from './app.service';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@ApiTags('System')
@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  constructor(
    private readonly appService: AppService,
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Root health check' })
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  @ApiOperation({ summary: 'Health check endpoint (DB + Redis connectivity)' })
  async getHealth() {
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

    const allHealthy = Object.values(checks).every((v) => v === 'connected');
    return {
      status: allHealthy ? 'ok' : 'degraded',
      checks,
    };
  }
}
