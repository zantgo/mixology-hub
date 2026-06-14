import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AiRecipeService } from './ai.service';
import { AiController } from './ai.controller';
import { AiGeneratedRecipe } from './entities/ai.entity';
import { UserAiQuota } from './entities/user-ai-quota.entity';
import { AiToolAudit } from './entities/ai-tool-audit.entity';
import { User } from '../users/entities/user.entity';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
import { Cocktail } from '../cocktails/entities/cocktail.entity';
import { CocktailIngredient } from '../cocktails/entities/cocktail-ingredient.entity';
import { ExternalModule } from '../external/external.module';
import { IngredientsModule } from '../ingredients/ingredients.module';
import { InventoryModule } from '../inventory/inventory.module';
import { CocktailsModule } from '../cocktails/cocktails.module';
import { UtilsModule } from '../utils/utils.module';
import { AiAuditInterceptor } from './interceptors/ai-audit.interceptor';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AiGeneratedRecipe,
      UserAiQuota,
      AiToolAudit,
      User,
      Ingredient,
      Cocktail,
      CocktailIngredient,
    ]),
    ConfigModule,
    ExternalModule,
    IngredientsModule,
    InventoryModule,
    CocktailsModule,
    UtilsModule,
  ],
  controllers: [AiController],
  providers: [AiRecipeService, AiAuditInterceptor],
  exports: [AiRecipeService],
})
export class AiModule {}
