import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiQuery, ApiConsumes } from '@nestjs/swagger';
import { CocktailsService } from './cocktails.service';
import { CocktailAggregatorService } from './cocktail-aggregator.service';
import { CreateCocktailDto } from './dto/create-cocktail.dto';
import { CreateCocktailWithFileDto } from './dto/create-cocktail-with-file.dto';
import { UpdateCocktailDto } from './dto/update-cocktail.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { User } from '../users/entities/user.entity';
import { ImageService } from '../images/image.service';

@ApiTags('Cocktails')
@Controller('cocktails')
export class CocktailsController {
  constructor(
    private readonly cocktailsService: CocktailsService,
    private readonly aggregatorService: CocktailAggregatorService,
    private readonly imageService: ImageService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new personal cocktail recipe' })
  @ApiConsumes('application/json', 'multipart/form-data')
  @UseInterceptors(FileInterceptor('image', {
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max upload
    fileFilter: (req, file, cb) => {
      if (file && file.mimetype.match(/^image\/(jpeg|png|webp)$/)) {
        cb(null, true);
      } else if (file) {
        cb(new Error('Only JPG, PNG, and WebP are allowed'), false);
      } else {
        cb(null, true); // No file is ok
      }
    }
  }))
  async create(
    @Body() body: any,
    @UploadedFile() file: Express.Multer.File,
    @GetUser() user: User
  ) {
    let createCocktailDto: CreateCocktailDto;
    
    // Check if we have multipart/form-data with JSON in 'data' field
    if (body && body.data) {
      try {
        createCocktailDto = JSON.parse(body.data);
      } catch (error) {
        throw new BadRequestException('Invalid JSON data in form field "data"');
      }
    } else {
      // Regular JSON request
      createCocktailDto = body as CreateCocktailDto;
    }

    let imagePaths: { full: string | null; thumb: string | null } = { full: null, thumb: null };
    
    if (file) {
      imagePaths = await this.imageService.processAndSaveImage(file);
    }

    return this.cocktailsService.create({
      ...createCocktailDto,
      imageFull: imagePaths.full || undefined,
      imageThumb: imagePaths.thumb || undefined
    }, user.id);
  }

  @Post(':id/prepare')
  @ApiOperation({ summary: 'Prepare a cocktail and deplete inventory' })
  prepare(
    @Param('id') id: string,
    @GetUser() user: User
  ) {
    return this.cocktailsService.prepare(id, user.id);
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
  @ApiConsumes('application/json', 'multipart/form-data')
  @UseInterceptors(FileInterceptor('image', {
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max upload
    fileFilter: (req, file, cb) => {
      if (file && file.mimetype.match(/^image\/(jpeg|png|webp)$/)) {
        cb(null, true);
      } else if (file) {
        cb(new Error('Only JPG, PNG, and WebP are allowed'), false);
      } else {
        cb(null, true); // No file is ok
      }
    }
  }))
  async update(
    @Param('id') id: string,
    @Body() body: any,
    @UploadedFile() file: Express.Multer.File,
    @GetUser() user: User
  ) {
    let updateCocktailDto: UpdateCocktailDto;
    
    // Check if we have multipart/form-data with JSON in 'data' field
    if (body && body.data) {
      try {
        updateCocktailDto = JSON.parse(body.data);
      } catch (error) {
        throw new BadRequestException('Invalid JSON data in form field "data"');
      }
    } else {
      // Regular JSON request
      updateCocktailDto = body as UpdateCocktailDto;
    }

    let imagePaths: { full: string | null; thumb: string | null } = { full: null, thumb: null };
    
    if (file) {
      imagePaths = await this.imageService.processAndSaveImage(file);
    }

    return this.cocktailsService.update(id, {
      ...updateCocktailDto,
      imageFull: imagePaths.full || undefined,
      imageThumb: imagePaths.thumb || undefined
    }, user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a personal cocktail recipe' })
  remove(@Param('id') id: string) {
    return this.cocktailsService.remove(id);
  }
}
