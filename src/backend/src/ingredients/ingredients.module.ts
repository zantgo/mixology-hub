import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IngredientsService } from './ingredients.service';
import { IngredientsController } from './ingredients.controller';
import { HierarchicalIngredientService } from './hierarchical-ingredient.service';
import { Ingredient } from './entities/ingredient.entity';
import { CocktailIngredient } from '../cocktails/entities/cocktail-ingredient.entity';
import { BarInventory } from '../inventory/entities/bar-inventory.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Ingredient, CocktailIngredient, BarInventory]),
    AuthModule,
  ],
  controllers: [IngredientsController],
  providers: [IngredientsService, HierarchicalIngredientService],
  exports: [TypeOrmModule, IngredientsService, HierarchicalIngredientService],
})
export class IngredientsModule {}
