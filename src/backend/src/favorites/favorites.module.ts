import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FavoritesService } from './favorites.service';
import { FavoritesController } from './favorites.controller';
import { Favorite } from './entities/favorite.entity';
import { User } from '../users/entities/user.entity';
import { Cocktail } from '../cocktails/entities/cocktail.entity';
import { HiddenExternalCocktail } from '../cocktails/entities/hidden-external-cocktail.entity';
import { CocktailsModule } from '../cocktails/cocktails.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Favorite,
      User,
      Cocktail,
      HiddenExternalCocktail,
    ]),
    CocktailsModule,
  ],
  controllers: [FavoritesController],
  providers: [FavoritesService],
})
export class FavoritesModule {}
