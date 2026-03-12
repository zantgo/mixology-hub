import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { CocktailsService } from './cocktails.service';
import { CocktailAggregatorService } from './cocktail-aggregator.service'; // Importa el agregador
import { CreateCocktailDto } from './dto/create-cocktail.dto';
import { UpdateCocktailDto } from './dto/update-cocktail.dto';

@Controller('cocktails')
export class CocktailsController {
  constructor(
    private readonly cocktailsService: CocktailsService,
    private readonly aggregatorService: CocktailAggregatorService,
  ) {}

  @Post()
  create(@Body() createCocktailDto: CreateCocktailDto) {
    return this.cocktailsService.create(createCocktailDto);
  }

  @Get()
  async findAll(@Query('name') name?: string) {
    // Si viene el query param 'name', usamos el agregador
    if (name) {
      return this.aggregatorService.searchUnified(name);
    }
    // Si no, devolvemos todo lo local
    return this.cocktailsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.cocktailsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCocktailDto: UpdateCocktailDto) {
    return this.cocktailsService.update(id, updateCocktailDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.cocktailsService.remove(id);
  }
}
