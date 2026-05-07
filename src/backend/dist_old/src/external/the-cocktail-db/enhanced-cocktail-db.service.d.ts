import { HttpService } from '@nestjs/axios';
import { Cache } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
export declare class EnhancedTheCocktailDbService {
    private readonly httpService;
    private cacheManager;
    private readonly configService;
    private readonly baseUrl;
    private readonly logger;
    private circuitBreaker;
    private readonly circuitBreakerThreshold;
    private readonly circuitBreakerResetTimeout;
    private readonly rateLimitWindow;
    private readonly rateLimitMaxRequests;
    private requestTimestamps;
    constructor(httpService: HttpService, cacheManager: Cache, configService: ConfigService);
    searchByName(name: string, options?: {
        bypassCache?: boolean;
    }): Promise<any>;
    searchByIngredient(ingredient: string): Promise<any>;
    getCocktailById(id: string): Promise<any>;
    getRandomCocktail(): Promise<any>;
    getCircuitBreakerState(): {
        failures: number;
        lastFailure: number;
        state: "CLOSED" | "OPEN" | "HALF_OPEN";
        nextAttempt: number;
    };
    resetCircuitBreakerManually(): void;
    private sanitizeInput;
    private sanitizeResponse;
    private isCircuitClosed;
    private handleCircuitBreakerFailure;
    private resetCircuitBreaker;
    private checkRateLimit;
    private recordRequest;
}
