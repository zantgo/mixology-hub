import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { Ai } from './entities/ai.entity';

@Module({
  imports:[TypeOrmModule.forFeature([Ai])],
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}
