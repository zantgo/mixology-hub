import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiService } from './ai.service';
import { EnhancedAiService } from './enhanced-ai.service';
import { AiController } from './ai.controller';
import { Ai } from './entities/ai.entity';
import { UserAiQuotas } from './entities/user-ai-quotas.entity';
import { User } from '../users/entities/user.entity';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
import { Cocktail } from '../cocktails/entities/cocktail.entity';
import { CocktailIngredient } from '../cocktails/entities/cocktail-ingredient.entity';
import { ExternalModule } from '../external/external.module';
import { IngredientsModule } from '../ingredients/ingredients.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Ai, UserAiQuotas, User, Ingredient, Cocktail, CocktailIngredient]),
    ExternalModule,
    IngredientsModule,
  ],
  controllers: [AiController],
  providers: [AiService, EnhancedAiService],
  exports: [AiService, EnhancedAiService],
})
export class AiModule {}
