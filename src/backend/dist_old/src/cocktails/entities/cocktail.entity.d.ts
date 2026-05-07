import { User } from '../../users/entities/user.entity';
import { CocktailIngredient } from './cocktail-ingredient.entity';
export declare class Cocktail {
    id: string;
    name: string;
    description: string;
    instructions: string;
    is_public: boolean;
    source: string;
    external_id: string;
    image_full: string;
    image_thumb: string;
    is_deleted: boolean;
    user: User;
    ingredients: CocktailIngredient[];
    created_at: Date;
}
