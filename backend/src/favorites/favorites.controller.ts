import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FavoritesService } from './favorites.service';
import { CreateFavoriteDto } from './dto/create-favorite.dto';
import { UpdateFavoriteDto } from './dto/update-favorite.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Favorites')
@ApiBearerAuth()
@Controller('favorites')
@UseGuards(JwtAuthGuard)
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Post()
  @ApiOperation({ summary: 'Save a cocktail to favorites' })
  create(@Request() req, @Body() createFavoriteDto: CreateFavoriteDto) {
    return this.favoritesService.create(req.user.id, createFavoriteDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all user favorites with pagination' })
  findAll(@Request() req, @Query() paginationQuery: PaginationQueryDto) {
    return this.favoritesService.findAll(req.user.id, paginationQuery);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific favorite by ID' })
  findOne(@Request() req, @Param('id') id: string) {
    return this.favoritesService.findOne(req.user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a favorite record' })
  update(@Request() req, @Param('id') id: string, @Body() updateFavoriteDto: UpdateFavoriteDto) {
    return this.favoritesService.update(req.user.id, id, updateFavoriteDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove a favorite' })
  remove(@Request() req, @Param('id') id: string) {
    return this.favoritesService.remove(req.user.id, id);
  }
}
