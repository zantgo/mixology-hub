import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GdprDataRetentionService } from './gdpr-data-retention.service';
import { User } from './entities/user.entity';
import { BarInventory } from '../inventory/entities/bar-inventory.entity';
import { UserProfile } from './entities/user-profile.entity';
import { AiGeneratedRecipe } from '../ai/entities/ai.entity';
import { UserAiQuota } from '../ai/entities/user-ai-quota.entity';
import { Favorite } from '../favorites/entities/favorite.entity';
import { Cocktail } from '../cocktails/entities/cocktail.entity';
import { CocktailIngredient } from '../cocktails/entities/cocktail-ingredient.entity';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
import { CocktailRating } from '../cocktails/entities/cocktail-rating.entity';
import { TokenBlacklist } from '../auth/entities/token-blacklist.entity';
import { RefreshToken } from '../auth/entities/refresh-token.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      BarInventory,
      UserProfile,
      AiGeneratedRecipe,
      UserAiQuota,
      Favorite,
      Cocktail,
      CocktailIngredient,
      Ingredient,
      CocktailRating,
      TokenBlacklist,
      RefreshToken,
    ]),
  ],
  providers: [GdprDataRetentionService],
  exports: [GdprDataRetentionService],
})
export class GdprDataRetentionModule {}
