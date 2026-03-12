import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateAiDto } from './dto/create-ai.dto';
import { UpdateAiDto } from './dto/update-ai.dto';
import { Ai } from './entities/ai.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class AiService {
  constructor(
    @InjectRepository(Ai)
    private readonly aiRepository: Repository<Ai>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(createAiDto: CreateAiDto) {
    // Obtenemos el usuario mockeado de la base de datos
    const mockUser = await this.userRepository.findOne({ 
        where: { email: 'mock@test.com' } 
    });

    if (!mockUser) {
        throw new NotFoundException('Mock user not found in database');
    }

    // Aquí más adelante llamaremos al PollinationsAiService
    const aiRecipe = this.aiRepository.create({
      prompt: `Ingredients: ${createAiDto.ingredients.join(', ')}`,
      generated_recipe: { status: 'pending', ingredients: createAiDto.ingredients },
      user: mockUser,
    });
    
    return await this.aiRepository.save(aiRecipe);
  }

  async findAll() {
    return await this.aiRepository.find({ relations: ['user'] });
  }

  async findOne(id: string) {
    const aiRecipe = await this.aiRepository.findOne({ 
      where: { id },
      relations: ['user'] 
    });
    if (!aiRecipe) throw new NotFoundException(`AI record with ID ${id} not found`);
    return aiRecipe;
  }

  async update(id: string, updateAiDto: UpdateAiDto) {
    const aiRecipe = await this.findOne(id);
    Object.assign(aiRecipe, updateAiDto);
    return await this.aiRepository.save(aiRecipe);
  }

  async remove(id: string) {
    const aiRecipe = await this.findOne(id);
    return await this.aiRepository.remove(aiRecipe);
  }
}
