import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IngredientsService } from './ingredients.service';
import { IngredientsController } from './ingredients.controller';
import { HierarchicalIngredientService } from './hierarchical-ingredient.service';
import { Ingredient } from './entities/ingredient.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Ingredient])],
  controllers: [IngredientsController],
  providers: [IngredientsService, HierarchicalIngredientService],
  exports: [TypeOrmModule, IngredientsService, HierarchicalIngredientService],
})
export class IngredientsModule {}
