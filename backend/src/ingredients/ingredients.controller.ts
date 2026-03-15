import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { IngredientsService } from './ingredients.service';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { UpdateIngredientDto } from './dto/update-ingredient.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

@ApiTags('Ingredients')
@Controller('ingredients')
export class IngredientsController {
  constructor(private readonly ingredientsService: IngredientsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new ingredient in the global catalog' })
  create(@Body() createIngredientDto: CreateIngredientDto) {
    return this.ingredientsService.create(createIngredientDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all available ingredients with pagination' })
  findAll(@Query() paginationQuery: PaginationQueryDto) {
    return this.ingredientsService.findAll(paginationQuery);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific ingredient by ID' })
  findOne(@Param('id') id: string) {
    return this.ingredientsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an ingredient' })
  update(@Param('id') id: string, @Body() updateIngredientDto: UpdateIngredientDto) {
    return this.ingredientsService.update(id, updateIngredientDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an ingredient from the catalog' })
  remove(@Param('id') id: string) {
    return this.ingredientsService.remove(id);
  }
}
