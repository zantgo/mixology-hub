import { Module, Global } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';

@Global() // Lo hacemos global para que cualquier servicio pueda inyectar el CACHE_MANAGER
@Module({
  imports: [
    CacheModule.registerAsync({
      useFactory: async () => ({
        store: await redisStore({
          socket: {
            host: 'localhost',
            port: 6379,
          },
          ttl: 600000, // 10 minutos por defecto
        }),
      }),
    }),
  ],
  exports: [CacheModule],
})
export class RedisCacheModule {}
