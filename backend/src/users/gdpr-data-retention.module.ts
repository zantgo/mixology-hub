import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { GdprDataRetentionService } from './gdpr-data-retention.service';
import { User } from './entities/user.entity';
import { UserInventory } from './entities/user-inventory.entity';
import { Ai } from '../ai/entities/ai.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserInventory, Ai]),
    ScheduleModule.forRoot(),
  ],
  providers: [GdprDataRetentionService],
  exports: [GdprDataRetentionService],
})
export class GdprDataRetentionModule {}