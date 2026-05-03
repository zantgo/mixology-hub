export interface AiGenerationOptions {
  theme?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  language?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AiRecipe {
  name: string;
  description: string;
  instructions: string[];
  ingredients: Array<{
    name: string;
    amount: number;
    unit: string;
    note?: string;
  }>;
  metadata: {
    difficulty: string;
    preparationTime: string;
    servingSize: number;
    theme?: string;
  };
}

export interface IAiProvider {
  generateRecipe(ingredients: string[], options?: AiGenerationOptions): Promise<AiRecipe>;
  generateWithTools?(
    ingredients: string[],
    tools: Array<{ type: 'function'; function: { name: string; description: string; parameters: any } }>,
    toolExecutor: (toolName: string, args: any) => Promise<any>,
    options?: AiGenerationOptions,
  ): Promise<AiRecipe>;
  validateContent(content: string): Promise<{ isValid: boolean; issues: string[] }>;
  getModelInfo(): { name: string; version: string; capabilities: string[] };
}
