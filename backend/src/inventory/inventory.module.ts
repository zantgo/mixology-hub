import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BarInventory } from './entities/bar-inventory.entity';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
import { BarInventoryService } from './bar-inventory.service';
import { BarInventoryController } from './bar-inventory.controller';
import { UtilsModule } from '../utils/utils.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([BarInventory, Ingredient]),
    UtilsModule,
    AuthModule,
  ],
  controllers: [BarInventoryController],
  providers: [BarInventoryService],
  exports: [BarInventoryService, TypeOrmModule],
})
export class InventoryModule {}
