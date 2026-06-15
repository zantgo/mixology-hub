import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { CocktailsService } from './cocktails.service';
import { CocktailsController } from './cocktails.controller';
import { Cocktail } from './entities/cocktail.entity';
import { CocktailIngredient } from './entities/cocktail-ingredient.entity';
import { CocktailRating } from './entities/cocktail-rating.entity';
import { ExternalCocktailRating } from './entities/external-cocktail-rating.entity';
import { PreparationLog } from './entities/preparation-log.entity';
import { ReportedContent } from './entities/reported-content.entity';
import { ZeroResultSearch } from './entities/zero-result-search.entity';
import { HiddenExternalCocktail } from './entities/hidden-external-cocktail.entity';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
import { User } from '../users/entities/user.entity';
import { ExternalModule } from '../external/external.module';
import { IngredientsModule } from '../ingredients/ingredients.module';
import { CocktailAggregatorService } from './cocktail-aggregator.service';
import { RatingService } from './rating.service';
import { UtilsModule } from '../utils/utils.module';
import { InventoryModule } from '../inventory/inventory.module';
import { ImageService } from '../images/image.service';
import { ImageCleanupService } from '../images/image-cleanup.service';
import { FavoritesModule } from '../favorites/favorites.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Cocktail,
      CocktailIngredient,
      CocktailRating,
      ExternalCocktailRating,
      ReportedContent,
      PreparationLog,
      ZeroResultSearch,
      Ingredient,
      User,
      HiddenExternalCocktail,
    ]),
    UtilsModule,
    HttpModule,
    ExternalModule,
    IngredientsModule,
    InventoryModule,
    FavoritesModule,
  ],
  controllers: [CocktailsController],
  providers: [
    CocktailsService,
    CocktailAggregatorService,
    RatingService,
    ImageService,
    ImageCleanupService,
  ],
  exports: [CocktailAggregatorService, CocktailsService, TypeOrmModule],
})
export class CocktailsModule {}
