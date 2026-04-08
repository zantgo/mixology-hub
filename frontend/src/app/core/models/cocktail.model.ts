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
  is_public: boolean;
  source: 'local' | 'api' | 'ai';
  external_id?: string;
  image_url?: string;
  ingredients: CocktailIngredient[];
  created_at: Date;
}