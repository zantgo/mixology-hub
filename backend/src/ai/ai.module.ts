import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { Ai } from './entities/ai.entity';
import { User } from '../users/entities/user.entity';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
import { Cocktail } from '../cocktails/entities/cocktail.entity';
import { CocktailIngredient } from '../cocktails/entities/cocktail-ingredient.entity';
import { ExternalModule } from '../external/external.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Ai, User, Ingredient, Cocktail, CocktailIngredient]),
    ExternalModule,
  ],
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}
