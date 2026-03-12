import { Injectable } from '@nestjs/common';
import { CreateCocktailDto } from './dto/create-cocktail.dto';
import { UpdateCocktailDto } from './dto/update-cocktail.dto';

@Injectable()
export class CocktailsService {
  create(createCocktailDto: CreateCocktailDto) {
    return 'This action adds a new cocktail';
  }

  findAll() {
    return `This action returns all cocktails`;
  }

  findOne(id: number) {
    return `This action returns a #${id} cocktail`;
  }

  update(id: number, updateCocktailDto: UpdateCocktailDto) {
    return `This action updates a #${id} cocktail`;
  }

  remove(id: number) {
    return `This action removes a #${id} cocktail`;
  }
}
