import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GdprDataRetentionService } from './gdpr-data-retention.service';
import { User } from './entities/user.entity';
import { BarInventory } from '../inventory/entities/bar-inventory.entity';
import { UserProfile } from './entities/user-profile.entity';
import { Ai } from '../ai/entities/ai.entity';
import { UserAiQuotas } from '../ai/entities/user-ai-quotas.entity';
import { Favorite } from '../favorites/entities/favorite.entity';
import { Cocktail } from '../cocktails/entities/cocktail.entity';
import { CocktailIngredient } from '../cocktails/entities/cocktail-ingredient.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      BarInventory,
      UserProfile,
      Ai,
      UserAiQuotas,
      Favorite,
      Cocktail,
      CocktailIngredient,
    ]),
  ],
  providers: [GdprDataRetentionService],
  exports: [GdprDataRetentionService],
})
export class GdprDataRetentionModule {}
