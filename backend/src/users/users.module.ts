import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { GdprController } from './gdpr.controller';
import { SeederService } from '../database/seeder.service';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
import { Cocktail } from '../cocktails/entities/cocktail.entity';
import { UtilsModule } from '../utils/utils.module';
import { GdprDataRetentionModule } from './gdpr-data-retention.module';
import { AdminGuard } from '../auth/guards/admin.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Ingredient, Cocktail]),
    UtilsModule,
    GdprDataRetentionModule,
  ],
  controllers: [UsersController, GdprController],
  providers: [UsersService, SeederService, AdminGuard],
  exports: [TypeOrmModule, UsersService, GdprDataRetentionModule],
})
export class UsersModule {}
