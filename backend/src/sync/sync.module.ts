import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SyncService } from './sync.service';
import { SyncOperation } from './entities/sync-operation.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SyncOperation])],
  providers: [SyncService],
  exports: [SyncService],
})
export class SyncModule {}