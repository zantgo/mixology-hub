import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BarInventory } from './entities/bar-inventory.entity';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
import { BarInventoryService } from './bar-inventory.service';
import { MakeabilityService } from './makeability.service';
import { BarInventoryController } from './bar-inventory.controller';
import { UtilsModule } from '../utils/utils.module';
import { AuthModule } from '../auth/auth.module';
import { IngredientsModule } from '../ingredients/ingredients.module';
import { CocktailsModule } from '../cocktails/cocktails.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([BarInventory, Ingredient]),
    UtilsModule,
    AuthModule,
    IngredientsModule,
    forwardRef(() => CocktailsModule),
  ],
  controllers: [BarInventoryController],
  providers: [BarInventoryService, MakeabilityService],
  exports: [BarInventoryService, TypeOrmModule],
})
export class InventoryModule {}
