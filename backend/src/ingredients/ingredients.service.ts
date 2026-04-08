import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { UpdateIngredientDto } from './dto/update-ingredient.dto';
import { Ingredient } from './entities/ingredient.entity';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

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
        baseUnit: createIngredientDto.baseUnit || 'ml', // Insertion of baseUnit if provided
      });
      return await this.ingredientRepository.save(ingredient);
    } catch (error: any) {
      // 23505 is the Postgres error code for Unique Violation
      if (error?.code === '23505') throw new ConflictException('Ingredient already exists');
      throw error;
    }
  }

  async findAll(paginationQuery: PaginationQueryDto) {
    const { limit = 10, offset = 0 } = paginationQuery;
    const [data, total] = await this.ingredientRepository.findAndCount({
      skip: offset,
      take: limit,
    });
    return { data, total, limit, offset };
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
