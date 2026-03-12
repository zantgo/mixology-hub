import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { CocktailsService } from './cocktails.service';
import { CocktailsController } from './cocktails.controller';
import { Cocktail } from './entities/cocktail.entity';
import { CocktailIngredient } from './entities/cocktail-ingredient.entity';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
import { User } from '../users/entities/user.entity'; // <-- ¡ESTA LÍNEA ES LA QUE FALTA!
import { ExternalModule } from '../external/external.module';
import { CocktailAggregatorService } from './cocktail-aggregator.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Cocktail, CocktailIngredient, Ingredient, User]),
    HttpModule,
    ExternalModule
  ],
  controllers: [CocktailsController],
  providers: [CocktailsService, CocktailAggregatorService],
  exports: [CocktailAggregatorService]
})
export class CocktailsModule {}
