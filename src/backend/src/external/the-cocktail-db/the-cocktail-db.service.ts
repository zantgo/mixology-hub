import { Injectable, Inject } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class TheCocktailDbService {
  private readonly baseUrl = 'https://www.thecocktaildb.com/api/json/v1/1';

  constructor(
    private readonly httpService: HttpService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async searchByName(name: string) {
    // 1. Try to get from cache
    const cacheKey = `cocktail_search_${name.toLowerCase()}`;
    const cachedData = await this.cacheManager.get(cacheKey);
    if (cachedData) return cachedData;

    // 2. If no cache, call API
    const { data } = await firstValueFrom(
      this.httpService.get(`${this.baseUrl}/search.php?s=${name}`),
    );

    // 3. Save to cache for 6 hours
    if (data.drinks) {
      await this.cacheManager.set(cacheKey, data.drinks, 21600000);
    }

    return data.drinks || [];
  }
}
