import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios'; // Required for HttpService
import { TheCocktailDbService } from './the-cocktail-db/the-cocktail-db.service';
import { PollinationsAiService } from './pollinations-ai/pollinations-ai.service';
import { RedisCacheModule } from '../redis-cache/redis-cache.module'; // Required for CACHE_MANAGER

@Module({
  imports: [
    HttpModule,
    RedisCacheModule, // Because this is global, it allows injecting CACHE_MANAGER
  ],
  providers: [TheCocktailDbService, PollinationsAiService],
  exports: [TheCocktailDbService, PollinationsAiService], // Exported so other modules can use them
})
export class ExternalModule {}
