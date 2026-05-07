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
  imageFull?: string;
  imageThumb?: string;
  ingredients: CocktailIngredient[];
  createdAt: Date;
}

export interface PaginationMeta {
  currentPage: number;
  nextPage: number | null;
  itemsPerPage: number;
  totalItems: number;
  totalPages: number;
}
