import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { RedisCacheModule } from './redis-cache/redis-cache.module';
import { ExternalModule } from './external/external.module';
import { UsersModule } from './users/users.module';
import { CocktailsModule } from './cocktails/cocktails.module';
import { IngredientsModule } from './ingredients/ingredients.module';
import { FavoritesModule } from './favorites/favorites.module';
import { AiModule } from './ai/ai.module';

@Module({
  imports:[
    // Configuración global de variables de entorno (.env)
    ConfigModule.forRoot({
      isGlobal: true, 
    }),
    DatabaseModule,
    RedisCacheModule,
    ExternalModule,
    UsersModule,
    CocktailsModule,
    IngredientsModule,
    FavoritesModule,
    AiModule,
  ],
})
export class AppModule {}
