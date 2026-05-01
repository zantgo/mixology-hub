import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { UserInventory } from './entities/user-inventory.entity';
import { UserInventoryService } from './user-inventory.service';
import { UserInventoryController } from './user-inventory.controller';
import { GdprController } from './gdpr.controller';
import { SeederService } from '../database/seeder.service';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
import { Cocktail } from '../cocktails/entities/cocktail.entity';
import { UtilsModule } from '../utils/utils.module';
import { GdprDataRetentionModule } from './gdpr-data-retention.module';
import { AdminGuard } from '../auth/guards/admin.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserInventory, Ingredient, Cocktail]),
    UtilsModule,
    GdprDataRetentionModule,
  ],
  controllers:[UsersController, UserInventoryController, GdprController],
  providers:[UsersService, UserInventoryService, SeederService, AdminGuard],
  exports: [TypeOrmModule, UsersService, UserInventoryService, GdprDataRetentionModule],
})
export class UsersModule {}
