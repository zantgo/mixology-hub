import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FavoritesService } from './favorites.service';
import { FavoritesController } from './favorites.controller';
import { Favorite } from './entities/favorite.entity';
import { User } from '../users/entities/user.entity';
import { Cocktail } from '../cocktails/entities/cocktail.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Favorite, User, Cocktail])],
  controllers: [FavoritesController],
  providers: [FavoritesService],
})
export class FavoritesModule {}
