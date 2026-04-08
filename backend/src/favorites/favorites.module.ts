import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FavoritesService } from './favorites.service';
import { FavoritesController } from './favorites.controller';
import { Favorite } from './entities/favorite.entity';
import { User } from '../users/entities/user.entity'; // <-- Imported User entity

@Module({
  imports: [TypeOrmModule.forFeature([Favorite, User])], // <-- Added to forFeature array
  controllers: [FavoritesController],
  providers: [FavoritesService],
})
export class FavoritesModule {}
