import { Decimal } from 'decimal.js';
import { Cocktail } from './cocktail.entity';
import { Ingredient } from '../../ingredients/entities/ingredient.entity';
export declare class CocktailIngredient {
    id: string;
    cocktail: Cocktail;
    ingredient: Ingredient;
    measure: string;
    amount: Decimal;
    unit: string;
}
