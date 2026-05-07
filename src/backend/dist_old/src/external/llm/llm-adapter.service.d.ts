import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { IAiProvider, AiGenerationOptions, AiRecipe } from '../ai-provider.interface';
export declare class LlmAdapterService implements IAiProvider {
    private readonly httpService;
    private readonly configService;
    private readonly logger;
    constructor(httpService: HttpService, configService: ConfigService);
    generateRecipe(ingredients: string[], options?: AiGenerationOptions): Promise<AiRecipe>;
    validateContent(content: string): Promise<{
        isValid: boolean;
        issues: string[];
    }>;
    getModelInfo(): {
        name: string;
        version: string;
        capabilities: string[];
    };
    private sanitizeUserInput;
}
