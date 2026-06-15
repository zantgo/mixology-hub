import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AddPgTrgm1746496000000 } from '../migrations/1746496000000-add-pg-trgm';
import { FixArchitecturalInconsistencies1733702400000 } from '../migrations/1733702400000-fix-architectural-inconsistencies';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USER'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME'),
        autoLoadEntities: true,
        synchronize: configService.get<string>('NODE_ENV') !== 'production',
        migrationsRun: configService.get<string>('NODE_ENV') === 'production',
        migrations: [
          FixArchitecturalInconsistencies1733702400000,
          AddPgTrgm1746496000000,
        ],
        retryAttempts: 3,
        retryDelay: 3000,
      }),
    }),
  ],
})
export class DatabaseModule {}
