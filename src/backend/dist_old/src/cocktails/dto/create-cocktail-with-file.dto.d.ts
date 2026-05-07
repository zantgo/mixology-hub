declare class CreateCocktailIngredientDto {
    ingredientId: string;
    amount: number;
    unit: string;
    measure: string;
}
export declare class CreateCocktailWithFileDto {
    name: string;
    description?: string;
    instructions: string;
    ingredients: CreateCocktailIngredientDto[];
    isPublic?: boolean;
}
export {};
