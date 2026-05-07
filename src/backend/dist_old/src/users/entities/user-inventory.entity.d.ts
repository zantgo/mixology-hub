import { Decimal } from 'decimal.js';
import { User } from './user.entity';
import { Ingredient } from '../../ingredients/entities/ingredient.entity';
export declare class UserInventory {
    id: string;
    user: User;
    ingredient: Ingredient;
    quantity: Decimal;
    unit: string;
}
