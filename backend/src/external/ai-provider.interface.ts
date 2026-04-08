export interface IAiProvider {
  generateRecipe(ingredients: string[]): Promise<any>;
}
