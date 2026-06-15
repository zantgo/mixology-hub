import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FavoritesService } from './favorites.service';
import { CreateFavoriteDto } from './dto/create-favorite.dto';
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
    const userId: string = req.user.id;
    return this.favoritesService.create(userId, createFavoriteDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all user favorites with pagination' })
  findAll(
    @Request() req,
    @Query() paginationQuery: PaginationQueryDto,
    @Query('search') search?: string,
  ) {
    const userId: string = req.user.id;
    return this.favoritesService.findAll(userId, paginationQuery, search);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific favorite by ID' })
  findOne(@Request() req, @Param('id') id: string) {
    const userId: string = req.user.id;
    return this.favoritesService.findOne(userId, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove a favorite' })
  remove(@Request() req, @Param('id') id: string) {
    const userId: string = req.user.id;
    return this.favoritesService.remove(userId, id);
  }
}
