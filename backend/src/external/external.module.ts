import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { EnhancedTheCocktailDbService } from './the-cocktail-db/enhanced-cocktail-db.service';
import { LlmAdapterService } from './llm/llm-adapter.service';
import { RedisCacheModule } from '../redis-cache/redis-cache.module';

@Module({
  imports: [
    HttpModule,
    RedisCacheModule,
  ],
  providers: [EnhancedTheCocktailDbService, LlmAdapterService],
  exports: [EnhancedTheCocktailDbService, LlmAdapterService],
})
export class ExternalModule {}
