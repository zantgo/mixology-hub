import { Module, forwardRef } from '@nestjs/common'; // <-- Añadido forwardRef
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
import { UsersModule } from '../users/users.module'; // <-- AQUI ESTÁ EL FIX (Importar el módulo)

@Module({
  imports: [
    TypeOrmModule.forFeature([Cocktail, CocktailIngredient, Ingredient, User]),
    UtilsModule,
    HttpModule,
    ExternalModule,
    forwardRef(() => UsersModule), // <-- AQUI ESTÁ EL FIX (Inyectar el módulo)
  ],
  controllers:[CocktailsController],
  providers: [CocktailsService, CocktailAggregatorService],
  exports:[CocktailAggregatorService],
})
export class CocktailsModule {}
