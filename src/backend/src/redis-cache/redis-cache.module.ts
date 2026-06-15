import { Module, Global, Logger } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-redis-yet';
import { CacheInvalidationService } from './cache-invalidation.service';

@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        store: await redisStore({
          socket: {
            host: configService.get<string>('REDIS_HOST', 'redis'),
            port: configService.get<number>('REDIS_PORT', 6379),
            reconnectStrategy: (retries: number) => {
              const delay = Math.min(retries * 200, 3000);
              Logger.warn(
                `Redis reconnecting in ${delay}ms (attempt ${retries})`,
                'RedisCache',
              );
              return delay;
            },
          },
          ttl: 600000,
        }),
      }),
    }),
  ],
  providers: [CacheInvalidationService],
  exports: [CacheModule, CacheInvalidationService],
})
export class RedisCacheModule {}
