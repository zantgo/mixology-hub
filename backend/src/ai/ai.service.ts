import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateAiDto } from './dto/create-ai.dto';
import { UpdateAiDto } from './dto/update-ai.dto';
import { Ai } from './entities/ai.entity';
import { User } from '../users/entities/user.entity';
import { PollinationsAiService } from '../external/pollinations-ai/pollinations-ai.service';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    @InjectRepository(Ai) private readonly aiRepository: Repository<Ai>,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    private readonly aiProvider: PollinationsAiService,
  ) {}

  /**
   * Generates a new cocktail recipe using AI based on provided ingredients
   */
  async generateRecipe(createAiDto: CreateAiDto) {
    const mockUser = await this.userRepository.findOne({ 
        where: { email: 'mock@test.com' } 
    });

    if (!mockUser) {
        throw new NotFoundException('Mock user not found. Please ensure the seed user exists.');
    }

    // Call the external AI provider
    const recipe = await this.aiProvider.generateRecipe(createAiDto.ingredients);

    const aiRecipe = this.aiRepository.create({
      prompt: `Ingredients: ${createAiDto.ingredients.join(', ')}`,
      generated_recipe: recipe,
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
    if (!aiRecipe) throw new NotFoundException(`AI generated recipe with ID ${id} not found`);
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
