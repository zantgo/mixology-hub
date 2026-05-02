import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { CocktailsService } from './cocktails.service';
import { CocktailsController } from './cocktails.controller';
import { Cocktail } from './entities/cocktail.entity';
import { CocktailIngredient } from './entities/cocktail-ingredient.entity';
import { PreparationLog } from './entities/preparation-log.entity';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
import { User } from '../users/entities/user.entity';
import { ExternalModule } from '../external/external.module';
import { CocktailAggregatorService } from './cocktail-aggregator.service';
import { UtilsModule } from '../utils/utils.module';
import { InventoryModule } from '../inventory/inventory.module';
import { ImageService } from '../images/image.service';
import { BarOrdersProcessor } from '../queue/bar-orders.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([Cocktail, CocktailIngredient, PreparationLog, Ingredient, User]),
    UtilsModule,
    HttpModule,
    ExternalModule,
    InventoryModule,
  ],
  controllers: [CocktailsController],
  providers: [CocktailsService, CocktailAggregatorService, ImageService, BarOrdersProcessor],
  exports: [CocktailAggregatorService],
})
export class CocktailsModule {}
