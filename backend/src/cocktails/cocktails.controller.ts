import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { CocktailsService } from './cocktails.service';
import { CocktailAggregatorService } from './cocktail-aggregator.service';
import { CreateCocktailDto } from './dto/create-cocktail.dto';
import { UpdateCocktailDto } from './dto/update-cocktail.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

@ApiTags('Cocktails')
@Controller('cocktails')
export class CocktailsController {
  constructor(
    private readonly cocktailsService: CocktailsService,
    private readonly aggregatorService: CocktailAggregatorService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new personal cocktail recipe' })
  create(@Body() createCocktailDto: CreateCocktailDto) {
    return this.cocktailsService.create(createCocktailDto);
  }

  @Post(':id/prepare')
  @ApiOperation({ summary: 'Prepare a cocktail and deplete inventory' })
  prepare(@Param('id') id: string) {
    return this.cocktailsService.prepare(id);
  }

  @Get()
  @ApiOperation({ summary: 'List cocktails with pagination. Supports unified external search.' })
  @ApiQuery({ name: 'name', required: false, description: 'Search term for unified search' })
  async findAll(
    @Query() paginationQuery: PaginationQueryDto,
    @Query('name') name?: string,
  ) {
    if (name) {
      return this.aggregatorService.searchUnified(name, paginationQuery);
    }
    return this.cocktailsService.findAll(paginationQuery);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get local cocktail by ID' })
  findOne(@Param('id') id: string) {
    return this.cocktailsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a personal cocktail recipe' })
  update(@Param('id') id: string, @Body() updateCocktailDto: UpdateCocktailDto) {
    return this.cocktailsService.update(id, updateCocktailDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a personal cocktail recipe' })
  remove(@Param('id') id: string) {
    return this.cocktailsService.remove(id);
  }
}
