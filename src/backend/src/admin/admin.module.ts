import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { ReportedContent } from '../cocktails/entities/reported-content.entity';
import { HiddenExternalCocktail } from '../cocktails/entities/hidden-external-cocktail.entity';
import { SystemSetting } from '../users/entities/system-setting.entity';
import { User } from '../users/entities/user.entity';
import { Cocktail } from '../cocktails/entities/cocktail.entity';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
import { BarInventory } from '../inventory/entities/bar-inventory.entity';
import { CocktailIngredient } from '../cocktails/entities/cocktail-ingredient.entity';
import { AuthModule } from '../auth/auth.module';
import { IngredientsModule } from '../ingredients/ingredients.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ReportedContent,
      HiddenExternalCocktail,
      SystemSetting,
      User,
      Cocktail,
      Ingredient,
      BarInventory,
      CocktailIngredient,
    ]),
    AuthModule,
    IngredientsModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
