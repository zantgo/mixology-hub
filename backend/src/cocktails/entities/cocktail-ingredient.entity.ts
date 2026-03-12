import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Cocktail } from './cocktail.entity';
import { Ingredient } from '../../ingredients/entities/ingredient.entity';

@Entity('cocktail_ingredients')
export class CocktailIngredient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Cocktail, (cocktail) => cocktail.ingredients, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cocktail_id' })
  cocktail: Cocktail;

  // eager: true hace que siempre que pidamos un cóctel, nos traiga el nombre del ingrediente automáticamente.
  @ManyToOne(() => Ingredient, { eager: true }) 
  @JoinColumn({ name: 'ingredient_id' })
  ingredient: Ingredient;

  @Column()
  measure: string; // ej. "2 oz", "1 rodaja"
}
