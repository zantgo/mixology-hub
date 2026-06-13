import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { ReportedContent } from '../cocktails/entities/reported-content.entity';
import { HiddenExternalCocktails } from '../cocktails/entities/hidden-external-cocktails.entity';
import { SystemSettings } from '../users/entities/system-settings.entity';
import { User } from '../users/entities/user.entity';
import { Cocktail } from '../cocktails/entities/cocktail.entity';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
import { BarInventory } from '../inventory/entities/bar-inventory.entity';
import { CocktailIngredient } from '../cocktails/entities/cocktail-ingredient.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ReportedContent,
      HiddenExternalCocktails,
      SystemSettings,
      User,
      Cocktail,
      Ingredient,
      BarInventory,
      CocktailIngredient,
    ]),
    AuthModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
