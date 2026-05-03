import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { CocktailsService } from './cocktails.service';
import { CocktailsController } from './cocktails.controller';
import { Cocktail } from './entities/cocktail.entity';
import { CocktailIngredient } from './entities/cocktail-ingredient.entity';
import { CocktailRating } from './entities/cocktail-rating.entity';
import { PreparationLog } from './entities/preparation-log.entity';
import { ReportedContent } from './entities/reported-content.entity';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
import { User } from '../users/entities/user.entity';
import { ExternalModule } from '../external/external.module';
import { CocktailAggregatorService } from './cocktail-aggregator.service';
import { RatingService } from './services/rating.service';
import { UtilsModule } from '../utils/utils.module';
import { InventoryModule } from '../inventory/inventory.module';
import { ImageService } from '../images/image.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Cocktail, CocktailIngredient, CocktailRating, ReportedContent, PreparationLog, Ingredient, User]),
    UtilsModule,
    HttpModule,
    ExternalModule,
    InventoryModule,
  ],
  controllers: [CocktailsController],
  providers: [CocktailsService, CocktailAggregatorService, RatingService, ImageService],
  exports: [CocktailAggregatorService],
})
export class CocktailsModule {}
