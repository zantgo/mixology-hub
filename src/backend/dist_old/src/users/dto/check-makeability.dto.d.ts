export declare class RecipeIngredientDto {
    ingredientId: string;
    amount: number;
    unit: string;
}
export declare class CheckMakeabilityDto {
    ingredients: RecipeIngredientDto[];
}
