import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { FavoritesService } from './favorites.service';
import { CreateFavoriteDto } from './dto/create-favorite.dto';
import { UpdateFavoriteDto } from './dto/update-favorite.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

@ApiTags('Favorites')
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Post()
  @ApiOperation({ summary: 'Save a cocktail to favorites' })
  create(@Body() createFavoriteDto: CreateFavoriteDto) {
    return this.favoritesService.create(createFavoriteDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all user favorites with pagination' })
  findAll(@Query() paginationQuery: PaginationQueryDto) {
    return this.favoritesService.findAll(paginationQuery);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific favorite by ID' })
  findOne(@Param('id') id: string) {
    return this.favoritesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a favorite record' })
  update(@Param('id') id: string, @Body() updateFavoriteDto: UpdateFavoriteDto) {
    return this.favoritesService.update(id, updateFavoriteDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove a favorite' })
  remove(@Param('id') id: string) {
    return this.favoritesService.remove(id);
  }
}
