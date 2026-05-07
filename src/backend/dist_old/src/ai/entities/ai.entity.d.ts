import { User } from '../../users/entities/user.entity';
export declare class Ai {
    id: string;
    prompt: string;
    generated_recipe: any;
    recipe_data: any;
    validation_score: number;
    is_valid: boolean;
    saved_as_cocktail_id: string;
    attempts: number;
    user: User;
    created_at: Date;
}
