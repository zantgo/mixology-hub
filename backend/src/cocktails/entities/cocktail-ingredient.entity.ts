import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Cocktail } from './cocktail.entity';
import { Ingredient } from '../../ingredients/entities/ingredient.entity';

@Entity('cocktail_ingredients')
export class CocktailIngredient {
  @ApiProperty({ description: 'Unique identifier of the recipe-ingredient relationship' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Cocktail, (cocktail) => cocktail.ingredients, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cocktail_id' })
  cocktail: Cocktail;

  /**
   * The ingredient involved in the cocktail recipe.
   * 'eager: true' ensures that whenever we fetch a cocktail, the ingredient details (like name) are automatically included.
   */
  @ApiProperty({ type: () => Ingredient, description: 'The linked ingredient from the catalog' })
  @ManyToOne(() => Ingredient, { eager: true }) 
  @JoinColumn({ name: 'ingredient_id' })
  ingredient: Ingredient;

  /**
   * The display string of the measurement (e.g., "1 1/2 oz", "A pinch").
   * Essential for external APIs or AI responses that are hard to parse.
   */
  @ApiProperty({ example: '2 oz', description: 'Human-readable measurement string' })
  @Column()
  measure: string;

  /**
   * The exact numeric amount required. 
   * Crucial for inventory depletion logic and "Makeable" logic.
   * Using 'decimal' type in TypeORM is best practice for money/quantity to avoid floating-point errors.
   */
  @ApiProperty({ example: 2.00, description: 'Numeric amount for inventory calculation' })
  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  amount: number;

  /**
   * The strict unit of measurement (e.g., 'oz', 'ml', 'units').
   * Must align with the units used in UserInventory for successful mathematical conversion.
   */
  @ApiProperty({ example: 'oz', description: 'The unit used for calculations (ml, oz, grams)' })
  @Column({ default: 'units' })
  unit: string;
}
