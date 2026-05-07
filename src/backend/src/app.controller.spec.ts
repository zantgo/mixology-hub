import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { getDataSourceToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

describe('AppController', () => {
  let appController: AppController;

  const mockDataSource = {
    query: jest.fn().mockResolvedValue(undefined),
  };

  const mockCacheManager = {
    set: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue('ok'),
  };

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: getDataSourceToken(), useValue: mockDataSource },
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('health', () => {
    it('should return ok when db and redis are healthy', async () => {
      const result = await appController.getHealth();
      expect(result.status).toBe('ok');
      expect(result.checks.db).toBe('connected');
      expect(result.checks.redis).toBe('connected');
    });

    it('should return degraded when db fails', async () => {
      mockDataSource.query.mockRejectedValueOnce(new Error('DB error'));
      const result = await appController.getHealth();
      expect(result.status).toBe('degraded');
      expect(result.checks.db).toBe('error');
      expect(result.checks.redis).toBe('connected');
    });

    it('should return degraded when redis fails', async () => {
      mockCacheManager.set.mockRejectedValueOnce(new Error('Redis error'));
      const result = await appController.getHealth();
      expect(result.status).toBe('degraded');
      expect(result.checks.redis).toBe('error');
      expect(result.checks.db).toBe('connected');
    });
  });
});
