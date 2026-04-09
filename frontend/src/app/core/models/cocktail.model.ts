export interface CocktailIngredient {
  id: string;
  ingredient: {
    id: string;
    name: string;
  };
  measure: string;
  amount: number;
  unit: string;
}

export interface Cocktail {
  id: string;
  name: string;
  description?: string;
  instructions: string;
  isPublic: boolean;
  source: 'local' | 'api' | 'ai';
  externalId?: string;
  imageUrl?: string;
  ingredients: CocktailIngredient[];
  createdAt: Date;
}