/**
 * Structural integration test — validates AppModule composition
 * without connecting to external services (DB, Redis, BullMQ).
 *
 * Catches regressions like AppController not registered (I-01)
 * and verifies the health module is properly wired.
 */

import { AppModule } from './app.module';
import { AppController } from './app.controller';
import { HealthModule } from './health/health.module';
import { HealthController } from './health/health.controller';

describe('AppModule Structure', () => {
  it('should have AppController registered', () => {
    const controllers: any[] =
      Reflect.getMetadata('controllers', AppModule) ?? [];
    expect(controllers).toContain(AppController);
  });

  it('should import HealthModule', () => {
    const imports: any[] = Reflect.getMetadata('imports', AppModule) ?? [];
    expect(imports).toContain(HealthModule);
  });

  it('HealthModule should have HealthController registered', () => {
    const controllers: any[] =
      Reflect.getMetadata('controllers', HealthModule) ?? [];
    expect(controllers).toContain(HealthController);
  });

  it('HealthController should have a GET /health route', () => {
    const path: string = Reflect.getMetadata('path', HealthController);
    expect(path).toBe('health');
  });

  it('CsrfGuard should be registered as a global guard', () => {
    const providers: any[] = Reflect.getMetadata('providers', AppModule) ?? [];
    const guardProviders = providers.filter(
      (p: any) =>
        typeof p === 'object' && p !== null && typeof p.provide === 'string',
    );
    const hasCsrfGuard = guardProviders.some(
      (p: any) => p.provide === 'APP_GUARD' && p.useClass?.name === 'CsrfGuard',
    );
    expect(hasCsrfGuard).toBe(true);
  });
});
