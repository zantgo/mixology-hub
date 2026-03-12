import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { UpdateIngredientDto } from './dto/update-ingredient.dto';
import { Ingredient } from './entities/ingredient.entity';

@Injectable()
export class IngredientsService {
  constructor(
    @InjectRepository(Ingredient)
    private readonly ingredientRepository: Repository<Ingredient>,
  ) {}

  async create(createIngredientDto: CreateIngredientDto) {
    try {
      const ingredient = this.ingredientRepository.create({
        name: createIngredientDto.name.toLowerCase().trim(),
      });
      return await this.ingredientRepository.save(ingredient);
    } catch (error: any) {
      // 23505 es el código de error de Postgres para Unique Violation
      if (error?.code === '23505') throw new ConflictException('Ingredient already exists');
      throw error;
    }
  }

  async findAll() {
    return await this.ingredientRepository.find();
  }

  async findOne(id: string) {
    const ingredient = await this.ingredientRepository.findOne({ where: { id } });
    if (!ingredient) throw new NotFoundException(`Ingredient with ID ${id} not found`);
    return ingredient;
  }

  async update(id: string, updateIngredientDto: UpdateIngredientDto) {
    const ingredient = await this.findOne(id);
    Object.assign(ingredient, updateIngredientDto);
    return await this.ingredientRepository.save(ingredient);
  }

  async remove(id: string) {
    const ingredient = await this.findOne(id);
    return await this.ingredientRepository.remove(ingredient);
  }
}
