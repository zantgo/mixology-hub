import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios'; // Necesario para HttpService
import { TheCocktailDbService } from './the-cocktail-db/the-cocktail-db.service';
import { PollinationsAiService } from './pollinations-ai/pollinations-ai.service';
import { RedisCacheModule } from '../redis-cache/redis-cache.module'; // Necesario para CACHE_MANAGER

@Module({
  imports: [
    HttpModule,
    RedisCacheModule, // Al ser global, esto permite inyectar CACHE_MANAGER
  ],
  providers: [TheCocktailDbService, PollinationsAiService],
  exports: [TheCocktailDbService, PollinationsAiService], // Exportamos para que otros módulos los usen
})
export class ExternalModule {}
