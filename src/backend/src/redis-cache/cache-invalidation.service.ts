import { Injectable, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

interface RedisLikeStore {
  client?: {
    scanIterator?: (options: {
      MATCH: string;
      COUNT?: number;
    }) => AsyncIterable<string>;
  };
}

@Injectable()
export class CacheInvalidationService {
  private readonly logger = new Logger(CacheInvalidationService.name);

  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}

  async clearByPatterns(patterns: string[]): Promise<void> {
    try {
      const store = (this.cacheManager as Cache & { store?: RedisLikeStore })
        .store;
      if (store?.client?.scanIterator) {
        for (const pattern of patterns) {
          for await (const key of store.client.scanIterator({
            MATCH: pattern,
          })) {
            await this.cacheManager.del(key);
          }
        }
      } else {
        await this.cacheManager.clear();
      }
      this.logger.log(
        `Redis caches invalidated for patterns: ${patterns.join(', ')}`,
      );
    } catch (err) {
      this.logger.warn(
        'Failed to clear caches by pattern, falling back to full clear',
        err,
      );
      try {
        await this.cacheManager.clear();
      } catch {
        // Best-effort cleanup
      }
    }
  }

  async clearAll(): Promise<void> {
    try {
      await this.cacheManager.clear();
      this.logger.log('All Redis caches cleared');
    } catch (err) {
      this.logger.warn('Failed to clear all caches', err);
    }
  }
}
