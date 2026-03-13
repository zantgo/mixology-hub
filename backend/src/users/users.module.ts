import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { SeederService } from '../database/seeder.service'; // Importa el seeder

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UsersController],
  providers: [UsersService, SeederService], // Registra el Seeder aquí
  exports: [TypeOrmModule, UsersService],
})
export class UsersModule {}
