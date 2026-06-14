import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CocktailDbService } from './the-cocktail-db/cocktail-db.service';
import { LlmAdapterService } from './llm/llm-adapter.service';
import { RedisCacheModule } from '../redis-cache/redis-cache.module';

@Module({
  imports: [HttpModule, RedisCacheModule],
  providers: [CocktailDbService, LlmAdapterService],
  exports: [CocktailDbService, LlmAdapterService],
})
export class ExternalModule {}
