import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios'; // Required for HttpService
import { TheCocktailDbService } from './the-cocktail-db/the-cocktail-db.service';
import { EnhancedTheCocktailDbService } from './the-cocktail-db/enhanced-cocktail-db.service';
import { LlmAdapterService } from './llm/llm-adapter.service';
import { RedisCacheModule } from '../redis-cache/redis-cache.module'; // Required for CACHE_MANAGER

@Module({
  imports: [
    HttpModule,
    RedisCacheModule, // Because this is global, it allows injecting CACHE_MANAGER
  ],
  providers: [TheCocktailDbService, EnhancedTheCocktailDbService, LlmAdapterService],
  exports: [TheCocktailDbService, EnhancedTheCocktailDbService, LlmAdapterService], // Exported so other modules can use them
})
export class ExternalModule {}
