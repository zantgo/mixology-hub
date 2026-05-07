"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var LlmAdapterService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LlmAdapterService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("@nestjs/axios");
const config_1 = require("@nestjs/config");
const rxjs_1 = require("rxjs");
let LlmAdapterService = LlmAdapterService_1 = class LlmAdapterService {
    httpService;
    configService;
    logger = new common_1.Logger(LlmAdapterService_1.name);
    constructor(httpService, configService) {
        this.httpService = httpService;
        this.configService = configService;
    }
    async generateRecipe(ingredients, options) {
        const apiUrl = this.configService.get('AI_API_URL');
        const apiKey = this.configService.get('AI_API_KEY');
        const model = this.configService.get('AI_MODEL') || 'deepseek-chat';
        if (!apiUrl || !apiKey) {
            this.logger.error('AI Configuration missing in .env');
            throw new common_1.BadGatewayException('AI Service is not configured.');
        }
        const sanitizedIngredients = ingredients.map(ing => this.sanitizeUserInput(ing));
        const theme = options?.theme ? ` with a ${options.theme} theme` : '';
        const difficulty = options?.difficulty ? ` suitable for ${options.difficulty} skill level` : '';
        const language = options?.language || 'English';
        const prompt = `Act as a professional bartender. Create a cocktail${theme}${difficulty} using ONLY these ingredients: ${sanitizedIngredients.join(', ')}. 
    Return ONLY a raw JSON object with this structure: {
      "name": "string",
      "description": "string",
      "instructions": ["step1", "step2", ...],
      "ingredients": [{"name": "string", "amount": number, "unit": "string", "note": "optional string"}],
      "metadata": {
        "difficulty": "easy|medium|hard",
        "preparationTime": "string",
        "servingSize": number,
        "theme": "optional string"
      }
    }`;
        try {
            const response = await (0, rxjs_1.firstValueFrom)(this.httpService.post(apiUrl, {
                model: model,
                messages: [{ role: 'user', content: prompt }],
                response_format: { type: 'json_object' },
                max_tokens: options?.maxTokens || 1000,
                temperature: options?.temperature || 0.7,
            }, {
                headers: { Authorization: `Bearer ${apiKey}` }
            }));
            const rawContent = response.data.choices[0].message.content;
            const startIdx = rawContent.indexOf('{');
            const endIdx = rawContent.lastIndexOf('}');
            if (startIdx === -1 || endIdx === -1 || startIdx >= endIdx) {
                throw new common_1.BadGatewayException('LLM response does not contain valid JSON');
            }
            const jsonString = rawContent.substring(startIdx, endIdx + 1);
            const recipe = JSON.parse(jsonString);
            const validation = await this.validateContent(JSON.stringify(recipe));
            if (!validation.isValid) {
                throw new common_1.BadGatewayException(`Generated recipe failed validation: ${validation.issues.join(', ')}`);
            }
            return recipe;
        }
        catch (error) {
            this.logger.error('Failed to generate AI recipe', error.message);
            throw new common_1.BadGatewayException('LLM Provider failed to generate recipe.');
        }
    }
    async validateContent(content) {
        const issues = [];
        try {
            const parsed = JSON.parse(content);
            const harmfulPatterns = [
                /alcohol abuse/i,
                /underage drinking/i,
                /excessive consumption/i,
                /dangerous combination/i,
                /illegal substance/i,
                /hate speech/i,
                /violence/i,
                /self-harm/i,
            ];
            const contentString = JSON.stringify(parsed).toLowerCase();
            harmfulPatterns.forEach(pattern => {
                if (pattern.test(contentString)) {
                    issues.push(`Content contains potentially harmful pattern: ${pattern.source}`);
                }
            });
            if (!parsed.name || typeof parsed.name !== 'string') {
                issues.push('Recipe name is missing or invalid');
            }
            if (!parsed.ingredients || !Array.isArray(parsed.ingredients)) {
                issues.push('Ingredients array is missing or invalid');
            }
            else {
                parsed.ingredients.forEach((ing, index) => {
                    if (!ing.name || typeof ing.name !== 'string') {
                        issues.push(`Ingredient ${index + 1} name is missing or invalid`);
                    }
                    if (!ing.amount || typeof ing.amount !== 'number') {
                        issues.push(`Ingredient ${index + 1} amount is missing or invalid`);
                    }
                    if (!ing.unit || typeof ing.unit !== 'string') {
                        issues.push(`Ingredient ${index + 1} unit is missing or invalid`);
                    }
                });
            }
            if (!parsed.instructions || !Array.isArray(parsed.instructions)) {
                issues.push('Instructions array is missing or invalid');
            }
            return {
                isValid: issues.length === 0,
                issues
            };
        }
        catch (error) {
            return {
                isValid: false,
                issues: [`Invalid JSON format: ${error.message}`]
            };
        }
    }
    getModelInfo() {
        const model = this.configService.get('AI_MODEL') || 'deepseek-chat';
        const apiUrl = this.configService.get('AI_API_URL') || '';
        let provider = 'Generic LLM';
        if (apiUrl.includes('openai'))
            provider = 'OpenAI';
        else if (apiUrl.includes('anthropic'))
            provider = 'Anthropic';
        else if (apiUrl.includes('deepseek'))
            provider = 'DeepSeek';
        return {
            name: model,
            version: '1.0',
            capabilities: [
                'recipe-generation',
                'content-moderation',
                'json-output',
                'multi-language',
                'theme-customization'
            ]
        };
    }
    sanitizeUserInput(input) {
        const MAX_LENGTH = 500;
        const truncated = input.slice(0, MAX_LENGTH);
        const sanitized = truncated.replace(/[^a-zA-Z0-9\s,.\-'/&%()]/g, '');
        const blockedPatterns = [
            /ignore.*previous.*instructions/i,
            /system.*prompt/i,
            /output.*template/i,
            /disregard.*previous/i,
            /respond\s+in\s+plain\s+text/i,
            /forget\s+your\s+instructions/i,
            /you\s+are\s+now/i,
            /new\s+system\s+prompt/i,
        ];
        for (const pattern of blockedPatterns) {
            if (pattern.test(sanitized)) {
                throw new common_1.BadGatewayException('Input contains blocked patterns');
            }
        }
        return sanitized.trim();
    }
};
exports.LlmAdapterService = LlmAdapterService;
exports.LlmAdapterService = LlmAdapterService = LlmAdapterService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [axios_1.HttpService,
        config_1.ConfigService])
], LlmAdapterService);
//# sourceMappingURL=llm-adapter.service.js.map