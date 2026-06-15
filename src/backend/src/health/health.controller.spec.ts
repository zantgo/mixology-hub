import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthController } from './health.controller';
import { getDataSourceToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

describe('HealthController', () => {
  let healthController: HealthController;

  const mockDataSource = {
    query: jest.fn().mockResolvedValue(undefined),
  };

  const mockCacheManager = {
    set: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue('ok'),
  };

  const mockConfigService = {
    get: jest.fn().mockImplementation((key: string) => {
      if (key === 'AI_API_URL') return 'https://api.example.com';
      if (key === 'AI_API_KEY') return 'sk-test-key';
      return undefined;
    }),
  };

  const mockResponse = {
    status: jest.fn().mockReturnThis(),
  } as any;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: getDataSourceToken(), useValue: mockDataSource },
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    healthController = app.get<HealthController>(HealthController);
    jest.clearAllMocks();
  });

  describe('getHealth', () => {
    it('should return ok when all services are healthy', async () => {
      const result = await healthController.getHealth(mockResponse);
      expect(result.status).toBe('ok');
      expect(result.checks.db).toBe('connected');
      expect(result.checks.redis).toBe('connected');
      expect(result.checks.ai_provider).toBe('configured');
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should return degraded when db fails', async () => {
      mockDataSource.query.mockRejectedValueOnce(new Error('DB error'));
      const result = await healthController.getHealth(mockResponse);
      expect(result.status).toBe('degraded');
      expect(result.checks.db).toBe('error');
      expect(result.checks.redis).toBe('connected');
      expect(result.checks.ai_provider).toBe('configured');
      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    });

    it('should return degraded when redis fails', async () => {
      mockCacheManager.set.mockRejectedValueOnce(new Error('Redis error'));
      const result = await healthController.getHealth(mockResponse);
      expect(result.status).toBe('degraded');
      expect(result.checks.redis).toBe('error');
      expect(result.checks.db).toBe('connected');
      expect(result.checks.ai_provider).toBe('configured');
      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    });

    it('should report AI provider as error when not configured', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'AI_API_URL') return undefined;
        if (key === 'AI_API_KEY') return undefined;
        return undefined;
      });
      const result = await healthController.getHealth(mockResponse);
      expect(result.status).toBe('degraded');
      expect(result.checks.ai_provider).toBe('error');
      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    });
  });
});
