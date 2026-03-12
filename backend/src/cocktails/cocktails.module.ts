import { Module } from '@nestjs/common';
import { CocktailsService } from './cocktails.service';
import { CocktailsController } from './cocktails.controller';

@Module({
  controllers: [CocktailsController],
  providers: [CocktailsService],
})
export class CocktailsModule {}
