import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FavoritesService } from './favorites.service';
import { FavoritesController } from './favorites.controller';
import { Favorite } from './entities/favorite.entity';
import { User } from '../users/entities/user.entity'; // <-- Importado el User

@Module({
  imports: [TypeOrmModule.forFeature([Favorite, User])], // <-- Añadido al forFeature
  controllers: [FavoritesController],
  providers: [FavoritesService],
})
export class FavoritesModule {}
