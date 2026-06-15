import { Module, Global, Logger } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BarOrdersProcessor } from './bar-orders.processor';
import { BarInventory } from '../inventory/entities/bar-inventory.entity';
import { Cocktail } from '../cocktails/entities/cocktail.entity';
import { PreparationLog } from '../cocktails/entities/preparation-log.entity';
import { UtilsModule } from '../utils/utils.module';

const logger = new Logger('BullMQ');

const BarOrdersQueueModule = BullModule.registerQueue({
  name: 'bar-orders',
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 500,
    attempts: 1,
  },
});

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST', 'redis'),
          port: configService.get<number>('REDIS_PORT', 6379),
          maxRetriesPerRequest: null,
          enableOfflineQueue: true,
          retryStrategy: (times: number) => {
            // eslint-disable-next-line no-restricted-syntax
            const delay = Math.min(times * 200, 3000);
            logger.warn(`Redis retry attempt ${times}, waiting ${delay}ms`);
            return delay;
          },
        },
      }),
    }),
    BarOrdersQueueModule,
    TypeOrmModule.forFeature([BarInventory, Cocktail, PreparationLog]),
    UtilsModule,
  ],
  providers: [BarOrdersProcessor],
  exports: [BullModule, BarOrdersQueueModule],
})
export class QueueModule {}
