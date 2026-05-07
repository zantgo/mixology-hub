import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AiService } from './ai.service';
import { EnhancedAiService } from './enhanced-ai.service';
import { AiController } from './ai.controller';
import { Ai } from './entities/ai.entity';
import { UserAiQuotas } from './entities/user-ai-quotas.entity';
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
      Ai,
      UserAiQuotas,
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
  providers: [AiService, EnhancedAiService, AiAuditInterceptor],
  exports: [AiService, EnhancedAiService],
})
export class AiModule {}
