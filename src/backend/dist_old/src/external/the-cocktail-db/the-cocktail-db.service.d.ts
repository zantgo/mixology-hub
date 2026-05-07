import { HttpService } from '@nestjs/axios';
import { Cache } from '@nestjs/cache-manager';
export declare class TheCocktailDbService {
    private readonly httpService;
    private cacheManager;
    private readonly baseUrl;
    constructor(httpService: HttpService, cacheManager: Cache);
    searchByName(name: string): Promise<any>;
}
