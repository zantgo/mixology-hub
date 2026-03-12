import { Module } from '@nestjs/common';
import { TheCocktailDbService } from './the-cocktail-db/the-cocktail-db.service';
import { PollinationsAiService } from './pollinations-ai/pollinations-ai.service';

@Module({
  providers: [TheCocktailDbService, PollinationsAiService]
})
export class ExternalModule {}
