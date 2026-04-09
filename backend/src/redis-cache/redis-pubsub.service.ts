import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'redis';

export enum RedisChannel {
  TOKEN_SALT_UPDATE = 'token_salt_update',
  CACHE_INVALIDATION = 'cache_invalidation',
}

export interface TokenSaltUpdateMessage {
  saltVersion: number;
  timestamp: Date;
  initiatedBy: string; // admin user ID or system
}

@Injectable()
export class RedisPubSubService implements OnModuleInit, OnModuleDestroy {
  private publisher: Redis.RedisClientType;
  private subscriber: Redis.RedisClientType;
  private tokenSaltVersion: number = 1;
  private saltVersionKey = 'global_token_salt_version';

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const redisConfig = {
      socket: {
        host: this.configService.get<string>('REDIS_HOST'),
        port: this.configService.get<number>('REDIS_PORT'),
      },
    };

    // Create Redis clients
    const { createClient } = await import('redis');
    this.publisher = createClient(redisConfig) as Redis.RedisClientType;
    this.subscriber = createClient(redisConfig) as Redis.RedisClientType;

    await this.publisher.connect();
    await this.subscriber.connect();

    // Subscribe to channels
    await this.subscriber.subscribe(RedisChannel.TOKEN_SALT_UPDATE, (message) => {
      this.handleTokenSaltUpdate(message);
    });

    // Load current salt version
    const storedVersion = await this.publisher.get(this.saltVersionKey);
    if (storedVersion) {
      this.tokenSaltVersion = parseInt(storedVersion, 10);
    }
  }

  async onModuleDestroy() {
    if (this.publisher) {
      await this.publisher.quit();
    }
    if (this.subscriber) {
      await this.subscriber.quit();
    }
  }

  private handleTokenSaltUpdate(message: string) {
    try {
      const update: TokenSaltUpdateMessage = JSON.parse(message);
      this.tokenSaltVersion = update.saltVersion;
      console.log(`Token salt updated to version ${update.saltVersion}`);
    } catch (error) {
      console.error('Failed to parse token salt update:', error);
    }
  }

  async getCurrentTokenSaltVersion(): Promise<number> {
    return this.tokenSaltVersion;
  }

  async incrementTokenSaltVersion(initiatedBy: string): Promise<number> {
    // Increment in Redis
    const newVersion = await this.publisher.incr(this.saltVersionKey);
    
    // Update local cache
    this.tokenSaltVersion = newVersion;

    // Broadcast to all instances
    const message: TokenSaltUpdateMessage = {
      saltVersion: newVersion,
      timestamp: new Date(),
      initiatedBy,
    };

    await this.publisher.publish(
      RedisChannel.TOKEN_SALT_UPDATE,
      JSON.stringify(message)
    );

    return newVersion;
  }

  async publishCacheInvalidation(channel: RedisChannel, data: any): Promise<void> {
    await this.publisher.publish(channel, JSON.stringify(data));
  }

  async subscribeToChannel(channel: RedisChannel, callback: (message: string) => void): Promise<void> {
    await this.subscriber.subscribe(channel, callback);
  }
}