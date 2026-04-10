import { Module, forwardRef } from '@nestjs/common'; // <-- Added forwardRef
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { CocktailsService } from './cocktails.service';
import { CocktailsController } from './cocktails.controller';
import { Cocktail } from './entities/cocktail.entity';
import { CocktailIngredient } from './entities/cocktail-ingredient.entity';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
import { User } from '../users/entities/user.entity';
import { ExternalModule } from '../external/external.module';
import { CocktailAggregatorService } from './cocktail-aggregator.service';
import { UtilsModule } from '../utils/utils.module';
import { UsersModule } from '../users/users.module'; // <-- FIX: Imported the module
import { ImageService } from '../images/image.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Cocktail, CocktailIngredient, Ingredient, User]),
    UtilsModule,
    HttpModule,
    ExternalModule,
    forwardRef(() => UsersModule), // <-- FIX: Injected the module
  ],
  controllers:[CocktailsController],
  providers: [CocktailsService, CocktailAggregatorService, ImageService],
  exports:[CocktailAggregatorService],
})
export class CocktailsModule {}
