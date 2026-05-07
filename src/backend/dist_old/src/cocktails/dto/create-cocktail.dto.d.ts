declare class CreateCocktailIngredientDto {
    ingredientId: string;
    amount: number;
    unit: string;
    measure: string;
}
export declare class CreateCocktailDto {
    name: string;
    description?: string;
    instructions: string;
    ingredients: CreateCocktailIngredientDto[];
    isPublic?: boolean;
}
export {};
