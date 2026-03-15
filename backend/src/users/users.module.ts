import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { UserInventory } from './entities/user-inventory.entity';
import { UserInventoryService } from './user-inventory.service';
import { UserInventoryController } from './user-inventory.controller';
import { SeederService } from '../database/seeder.service';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
import { Cocktail } from '../cocktails/entities/cocktail.entity';
import { UtilsModule } from '../utils/utils.module'; // <- Path relativo corregido

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserInventory, Ingredient, Cocktail]), // <- UtilsModule ya no está aquí
    UtilsModule // <- Se inyecta correctamente como módulo de Nest
  ],
  controllers:[UsersController, UserInventoryController],
  providers:[UsersService, UserInventoryService, SeederService],
  exports: [TypeOrmModule, UsersService, UserInventoryService],
})
export class UsersModule {}
