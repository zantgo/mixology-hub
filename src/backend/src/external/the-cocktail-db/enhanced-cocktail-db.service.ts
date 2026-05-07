import {
  Injectable,
  Inject,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import { ConfigService } from '@nestjs/config';

interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  nextAttempt: number;
}

@Injectable()
export class EnhancedTheCocktailDbService {
  private readonly baseUrl = 'https://www.thecocktaildb.com/api/json/v1/1';
  private readonly logger = new Logger(EnhancedTheCocktailDbService.name);
  private circuitBreaker: CircuitBreakerState = {
    failures: 0,
    lastFailure: 0,
    state: 'CLOSED',
    nextAttempt: 0,
  };
  private readonly circuitBreakerThreshold = 5;
  private readonly circuitBreakerResetTimeout = 60000; // 1 minute
  private readonly rateLimitWindow = 60000; // 1 minute
  private readonly rateLimitMaxRequests = 30; // 30 requests per minute
  private rateLimitCounter = 0;
  private rateLimitWindowStart = Date.now();

  constructor(
    private readonly httpService: HttpService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly configService: ConfigService,
  ) {}

  async searchByName(name: string, options?: { bypassCache?: boolean }) {
    // Validate input
    if (!name || name.trim().length === 0) {
      throw new BadRequestException('Search name cannot be empty');
    }

    // Sanitize input to prevent injection
    const sanitizedName = this.sanitizeInput(name);

    // Check circuit breaker
    if (!this.isCircuitClosed()) {
      this.logger.warn(`Circuit breaker is OPEN for TheCocktailDB API`);
      throw new InternalServerErrorException(
        'External API is temporarily unavailable',
      );
    }

    // Check rate limit
    if (!this.checkRateLimit()) {
      this.logger.warn(`Rate limit exceeded for TheCocktailDB API`);
      throw new InternalServerErrorException(
        'Rate limit exceeded for external API',
      );
    }

    // 1. Try to get from cache (unless bypassCache is true)
    const cacheKey = `cocktail_search_${sanitizedName.toLowerCase()}`;

    if (!options?.bypassCache) {
      const cachedData = await this.cacheManager.get(cacheKey);
      if (cachedData) {
        this.logger.debug(`Cache hit for search: ${sanitizedName}`);
        return cachedData;
      }
    }

    try {
      // Record request timestamp for rate limiting
      this.recordRequest();

      // 2. If no cache, call API with timeout
      const { data } = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrl}/search.php?s=${encodeURIComponent(sanitizedName)}`,
          {
            timeout: 10000, // 10 second timeout
            headers: {
              'User-Agent': 'MixologyHub/1.0',
            },
          },
        ),
      );

      // Reset circuit breaker on success
      this.resetCircuitBreaker();

      // 3. Validate and sanitize response
      const sanitizedData = this.sanitizeResponse(data);

      // 4. Save to cache for 6 hours (with shorter TTL for empty results)
      const cacheTtl = sanitizedData.drinks?.length > 0 ? 21600000 : 300000; // 6 hours or 5 minutes
      await this.cacheManager.set(
        cacheKey,
        sanitizedData.drinks || [],
        cacheTtl,
      );

      this.logger.log(
        `Successfully fetched ${sanitizedData.drinks?.length || 0} cocktails from TheCocktailDB`,
      );
      return sanitizedData.drinks || [];
    } catch (error) {
      // Handle circuit breaker logic
      this.handleCircuitBreakerFailure(error);

      // Log appropriate error
      if (error instanceof AxiosError) {
        if (error.code === 'ECONNABORTED') {
          this.logger.error(
            `TheCocktailDB API timeout for search: ${sanitizedName}`,
          );
          throw new InternalServerErrorException('External API timeout');
        } else if (error.response?.status === 429) {
          this.logger.error(
            `TheCocktailDB API rate limit exceeded for search: ${sanitizedName}`,
          );
          throw new InternalServerErrorException(
            'External API rate limit exceeded',
          );
        } else if (error.response?.status && error.response.status >= 500) {
          this.logger.error(
            `TheCocktailDB API server error (${error.response.status}) for search: ${sanitizedName}`,
          );
          throw new InternalServerErrorException('External API server error');
        }
      }

      this.logger.error(
        `Failed to fetch from TheCocktailDB for search: ${sanitizedName}`,
        error,
      );
      throw new InternalServerErrorException(
        'Failed to fetch from external API',
      );
    }
  }

  async searchByIngredient(ingredient: string) {
    // Similar implementation with circuit breaker and rate limiting
    const sanitizedIngredient = this.sanitizeInput(ingredient);

    if (!this.isCircuitClosed()) {
      throw new InternalServerErrorException(
        'External API is temporarily unavailable',
      );
    }

    if (!this.checkRateLimit()) {
      throw new InternalServerErrorException(
        'Rate limit exceeded for external API',
      );
    }

    const cacheKey = `cocktail_by_ingredient_${sanitizedIngredient.toLowerCase()}`;
    const cachedData = await this.cacheManager.get(cacheKey);
    if (cachedData) return cachedData;

    try {
      this.recordRequest();

      const { data } = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrl}/filter.php?i=${encodeURIComponent(sanitizedIngredient)}`,
          {
            timeout: 10000,
          },
        ),
      );

      this.resetCircuitBreaker();
      const sanitizedData = this.sanitizeResponse(data);

      await this.cacheManager.set(
        cacheKey,
        sanitizedData.drinks || [],
        21600000,
      );
      return sanitizedData.drinks || [];
    } catch (error) {
      this.handleCircuitBreakerFailure(error);
      this.logger.error(
        `Failed to fetch cocktails by ingredient: ${sanitizedIngredient}`,
        error,
      );
      throw new InternalServerErrorException(
        'Failed to fetch from external API',
      );
    }
  }

  async getCocktailById(id: string) {
    // Similar implementation with circuit breaker and rate limiting
    if (!this.isCircuitClosed()) {
      throw new InternalServerErrorException(
        'External API is temporarily unavailable',
      );
    }

    if (!this.checkRateLimit()) {
      throw new InternalServerErrorException(
        'Rate limit exceeded for external API',
      );
    }

    const cacheKey = `cocktail_by_id_${id}`;
    const cachedData = await this.cacheManager.get(cacheKey);
    if (cachedData) return cachedData;

    try {
      this.recordRequest();

      const { data } = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrl}/lookup.php?i=${encodeURIComponent(id)}`,
          {
            timeout: 10000,
          },
        ),
      );

      this.resetCircuitBreaker();
      const sanitizedData = this.sanitizeResponse(data);

      // Cache individual cocktails longer since they don't change often
      await this.cacheManager.set(
        cacheKey,
        sanitizedData.drinks?.[0] || null,
        86400000,
      ); // 24 hours
      return sanitizedData.drinks?.[0] || null;
    } catch (error) {
      this.handleCircuitBreakerFailure(error);
      this.logger.error(`Failed to fetch cocktail by ID: ${id}`, error);
      throw new InternalServerErrorException(
        'Failed to fetch from external API',
      );
    }
  }

  async getRandomCocktail() {
    // Similar implementation with circuit breaker and rate limiting
    if (!this.isCircuitClosed()) {
      throw new InternalServerErrorException(
        'External API is temporarily unavailable',
      );
    }

    if (!this.checkRateLimit()) {
      throw new InternalServerErrorException(
        'Rate limit exceeded for external API',
      );
    }

    const cacheKey = 'random_cocktail';
    // Don't cache random cocktails for too long since they should be different each time
    const cachedData = await this.cacheManager.get(cacheKey);
    if (cachedData) return cachedData;

    try {
      this.recordRequest();

      const { data } = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/random.php`, {
          timeout: 10000,
        }),
      );

      this.resetCircuitBreaker();
      const sanitizedData = this.sanitizeResponse(data);

      // Cache random cocktail for only 5 minutes
      await this.cacheManager.set(
        cacheKey,
        sanitizedData.drinks?.[0] || null,
        300000,
      );
      return sanitizedData.drinks?.[0] || null;
    } catch (error) {
      this.handleCircuitBreakerFailure(error);
      this.logger.error('Failed to fetch random cocktail', error);
      throw new InternalServerErrorException(
        'Failed to fetch from external API',
      );
    }
  }

  getCircuitBreakerState() {
    return Object.freeze({ ...this.circuitBreaker });
  }

  resetCircuitBreakerManually() {
    this.circuitBreaker = {
      failures: 0,
      lastFailure: 0,
      state: 'CLOSED',
      nextAttempt: 0,
    };
    this.logger.log('Circuit breaker manually reset');
  }

  private sanitizeInput(input: string): string {
    // Remove any potentially dangerous characters
    return input.trim().replace(/[<>"'`]/g, '');
  }

  private sanitizeResponse(data: any): any {
    if (!data || typeof data !== 'object') {
      return { drinks: [] };
    }

    // Ensure drinks is an array
    if (!Array.isArray(data.drinks)) {
      return { drinks: [] };
    }

    // Sanitize each drink
    const sanitizedDrinks = data.drinks
      .map((drink: any) => {
        if (!drink || typeof drink !== 'object') return null;

        const sanitizedDrink: any = {};

        // ADR 0016: Exclude image fields — never expose external image URLs.
        // Retain metadata fields used for filtering/display (category, glass, tags, alcoholic).
        const stringFields = [
          'strDrink',
          'strInstructions',
          'strCategory',
          'strAlcoholic',
          'strGlass',
          'strTags',
        ];
        const idFields = ['idDrink'];

        stringFields.forEach((field) => {
          if (drink[field] && typeof drink[field] === 'string') {
            // Basic HTML sanitization
            sanitizedDrink[field] = drink[field].replace(/[<>"'`]/g, '');
          }
        });

        idFields.forEach((field) => {
          if (drink[field]) {
            sanitizedDrink[field] = String(drink[field]);
          }
        });

        // Sanitize ingredients and measures (1-15)
        for (let i = 1; i <= 15; i++) {
          const ingredientField = `strIngredient${i}`;
          const measureField = `strMeasure${i}`;

          if (
            drink[ingredientField] &&
            typeof drink[ingredientField] === 'string'
          ) {
            sanitizedDrink[ingredientField] = drink[ingredientField]
              .replace(/[<>"'`]/g, '')
              .trim();
          }

          if (drink[measureField] && typeof drink[measureField] === 'string') {
            sanitizedDrink[measureField] = drink[measureField]
              .replace(/[<>"'`]/g, '')
              .trim();
          }
        }

        return sanitizedDrink;
      })
      .filter(Boolean);

    return { drinks: sanitizedDrinks };
  }

  private isCircuitClosed(): boolean {
    const now = Date.now();

    if (this.circuitBreaker.state === 'OPEN') {
      if (now >= this.circuitBreaker.nextAttempt) {
        // Transition to HALF_OPEN
        this.circuitBreaker.state = 'HALF_OPEN';
        this.logger.log('Circuit breaker transitioned to HALF_OPEN');
        return true;
      }
      return false;
    }

    return true;
  }

  private handleCircuitBreakerFailure(error: any): void {
    const now = Date.now();
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailure = now;

    if (this.circuitBreaker.failures >= this.circuitBreakerThreshold) {
      this.circuitBreaker.state = 'OPEN';
      this.circuitBreaker.nextAttempt = now + this.circuitBreakerResetTimeout;
      this.logger.error(
        `Circuit breaker OPENED after ${this.circuitBreaker.failures} failures`,
      );
    } else if (this.circuitBreaker.state === 'HALF_OPEN') {
      // HALF_OPEN failed, go back to OPEN
      this.circuitBreaker.state = 'OPEN';
      this.circuitBreaker.nextAttempt = now + this.circuitBreakerResetTimeout;
      this.logger.error('Circuit breaker re-OPENED after HALF_OPEN failure');
    }
  }

  private resetCircuitBreaker(): void {
    if (this.circuitBreaker.state === 'HALF_OPEN') {
      // Successful request in HALF_OPEN state, close the circuit
      this.circuitBreaker.state = 'CLOSED';
      this.circuitBreaker.failures = 0;
      this.logger.log(
        'Circuit breaker CLOSED after successful HALF_OPEN request',
      );
    } else if (this.circuitBreaker.failures > 0) {
      // Reset failure count on successful request
      this.circuitBreaker.failures = 0;
    }
  }

  private checkRateLimit(): boolean {
    const now = Date.now();
    // Reset window if expired
    if (now - this.rateLimitWindowStart >= this.rateLimitWindow) {
      this.rateLimitCounter = 0;
      this.rateLimitWindowStart = now;
    }
    return this.rateLimitCounter < this.rateLimitMaxRequests;
  }

  private recordRequest(): void {
    const now = Date.now();
    // Reset window if expired
    if (now - this.rateLimitWindowStart >= this.rateLimitWindow) {
      this.rateLimitCounter = 0;
      this.rateLimitWindowStart = now;
    }
    this.rateLimitCounter++;
  }
}
