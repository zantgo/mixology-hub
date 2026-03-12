import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { Ai } from './entities/ai.entity';
import { User } from '../users/entities/user.entity'; // <-- Importa User

@Module({
  imports: [TypeOrmModule.forFeature([Ai, User])], // <-- Agrega User aquí
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}
