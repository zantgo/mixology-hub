import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  UseGuards,
  Request,
} from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiConsumes,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CocktailsService } from './cocktails.service';
import {
  CocktailAggregatorService,
  type SearchOptions,
} from './cocktail-aggregator.service';
import { CreateCocktailDto } from './dto/create-cocktail.dto';

import { UpdateCocktailDto } from './dto/update-cocktail.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { User } from '../users/entities/user.entity';
import { ImageService } from '../images/image.service';
import { RatingService } from './rating.service';
import { RateCocktailDto } from './dto/rate-cocktail.dto';
import { ReportCocktailDto } from './dto/report-cocktail.dto';
import { ReportedContent } from './entities/reported-content.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

type MulterCallback = (error: Error | null, acceptFile: boolean) => void;

@ApiTags('Cocktails')
@ApiBearerAuth()
@Controller('cocktails')
export class CocktailsController {
  private static readonly IMAGE_FILE_FILTER = (
    _req: Request,
    file: Express.Multer.File,
    cb: MulterCallback,
  ) => {
    if (file && file.mimetype.match(/^image\/(jpeg|png|webp)$/)) {
      cb(null, true);
    } else if (file) {
      cb(new Error('Only JPG, PNG, and WebP are allowed'), false);
    } else {
      cb(null, true);
    }
  };

  constructor(
    private readonly cocktailsService: CocktailsService,
    private readonly aggregatorService: CocktailAggregatorService,
    private readonly imageService: ImageService,
    private readonly ratingService: RatingService,
    @InjectRepository(ReportedContent)
    private readonly reportRepository: Repository<ReportedContent>,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a new personal cocktail recipe' })
  @ApiConsumes('application/json', 'multipart/form-data')
  @UseInterceptors(
    FileInterceptor('image', {
      // eslint-disable-next-line no-restricted-syntax
      limits: { fileSize: 2 * 1024 * 1024 },
      fileFilter: CocktailsController.IMAGE_FILE_FILTER,
    }),
  )
  async create(
    @Body() body: Record<string, unknown>,
    @UploadedFile() file: Express.Multer.File,
    @GetUser() user: User,
  ) {
    let createCocktailDto: CreateCocktailDto;

    // Check if we have multipart/form-data with JSON in 'data' field
    if (body && typeof body.data === 'string') {
      try {
        createCocktailDto = JSON.parse(body.data) as CreateCocktailDto;
      } catch {
        throw new BadRequestException('Invalid JSON data in form field "data"');
      }
      // Re-validate the parsed JSON through DTO validation
      const instance = plainToInstance(CreateCocktailDto, createCocktailDto);
      const errors = await validate(instance, {
        whitelist: true,
        forbidNonWhitelisted: true,
      });
      if (errors.length > 0) {
        const messages = errors.flatMap((e) =>
          Object.values(e.constraints || {}),
        );
        throw new BadRequestException(['Validation failed', ...messages]);
      }
      createCocktailDto = instance;
    } else {
      // Regular JSON request — validate manually since body is typed as `any`
      const instance = plainToInstance(CreateCocktailDto, body);
      const errors = await validate(instance, {
        whitelist: true,
        forbidNonWhitelisted: true,
      });
      if (errors.length > 0) {
        const messages = errors.flatMap((e) =>
          Object.values(e.constraints || {}),
        );
        throw new BadRequestException(['Validation failed', ...messages]);
      }
      createCocktailDto = instance;
    }

    let imagePaths: { full: string | null; thumb: string | null } = {
      full: null,
      thumb: null,
    };

    if (file) {
      imagePaths = await this.imageService.processAndSaveImage(file);
    }

    try {
      return await this.cocktailsService.create(
        {
          ...createCocktailDto,
          imageFull: imagePaths.full || undefined,
          imageThumb: imagePaths.thumb || undefined,
        },
        user.id,
      );
    } catch (error) {
      if (imagePaths.full) {
        await fs
          .unlink(path.join(process.cwd(), imagePaths.full))
          .catch(() => {});
      }
      if (imagePaths.thumb) {
        await fs
          .unlink(path.join(process.cwd(), imagePaths.thumb))
          .catch(() => {});
      }
      throw error;
    }
  }

  @Post('batch-prepare')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary:
      'Enqueue a batch of cocktail preparation orders (returns 202 Accepted)',
  })
  batchPrepare(
    @GetUser() user: User,
    @Body()
    body: {
      orders: Array<{ cocktailId: string; servings?: number; force?: boolean }>;
    },
  ) {
    return this.cocktailsService.batchPrepare(user.id, body.orders);
  }

  @Post(':id/prepare')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Enqueue a cocktail preparation order (returns 202 Accepted)',
  })
  @ApiQuery({
    name: 'servings',
    required: false,
    description: 'Number of servings (default: 1)',
  })
  @ApiQuery({
    name: 'totalVolumeMl',
    required: false,
    description: 'Target total volume in ml for part-based recipes',
  })
  @ApiQuery({
    name: 'force',
    required: false,
    description: 'Force prepare with partial ingredients',
  })
  prepare(
    @Param('id') id: string,
    @GetUser() user: User,
    @Query('servings') servings?: string,
    @Query('totalVolumeMl') totalVolumeMl?: string,
    @Query('force') force?: string,
  ) {
    return this.cocktailsService.prepare(
      id,
      user.id,
      servings ? parseInt(servings, 10) : 1,
      totalVolumeMl,
      force === 'true',
    );
  }

  @Get('preparations/:logId/status')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Poll preparation status' })
  getPreparationStatus(@Param('logId') logId: string) {
    return this.cocktailsService.getPreparationStatus(logId);
  }

  @Post('preparations/:logId/undo')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Undo a completed preparation (returns 202 Accepted)',
  })
  undo(@Param('logId') logId: string) {
    return this.cocktailsService.undo(logId);
  }

  @Post('preparations/:logId/cancel')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel an in-flight cocktail preparation order' })
  cancelPreparation(@Param('logId') logId: string) {
    return this.cocktailsService.cancelPreparation(logId);
  }

  @Post(':id/rate')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rate a cocktail (1-5)' })
  rateCocktail(
    @Param('id') id: string,
    @GetUser() user: User,
    @Body() rateDto: RateCocktailDto,
  ) {
    return this.ratingService.rateCocktail(user, id, rateDto);
  }

  @Get(':id/my-rating')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current user rating for a cocktail' })
  getMyRating(@Param('id') id: string, @GetUser() user: User) {
    return this.ratingService.getUserRating(user, id);
  }

  @Get(':id/average-rating')
  @ApiOperation({ summary: 'Get average rating for a cocktail' })
  getAverageRating(@Param('id') id: string) {
    return this.ratingService.getCocktailAverageRating(id);
  }

  @Post(':id/report')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Report a cocktail for inappropriate content' })
  async reportCocktail(
    @Param('id') id: string,
    @GetUser() user: User,
    @Body() reportDto: ReportCocktailDto,
  ) {
    const isExternal = id.startsWith('ext-') || !id.includes('-');
    const cleanId = id.startsWith('ext-') ? id.slice(4) : id;

    const report = this.reportRepository.create({
      reportedBy: user,
      cocktail: !isExternal ? { id } : undefined,
      externalCocktailId: isExternal ? cleanId : undefined,
      reportReason: reportDto.reportReason,
      details: reportDto.details || undefined,
      status: 'pending',
    });
    return this.reportRepository.save(report);
  }

  @Get()
  @ApiOperation({
    summary:
      'List cocktails with pagination. Supports unified external search.',
  })
  @ApiQuery({
    name: 'name',
    required: false,
    description: 'Search term for unified search',
  })
  @ApiQuery({
    name: 'fuzzy',
    required: false,
    description:
      'Enable fuzzy/typo-tolerant search (requires pg_trgm extension)',
  })
  @ApiQuery({
    name: 'includeIngredients',
    required: false,
    description:
      'Comma-separated ingredient names. Only return cocktails containing ALL of them.',
  })
  @ApiQuery({
    name: 'category',
    required: false,
    description: 'Filter by cocktail category (e.g., Cocktail, Shot, Punch)',
  })
  @ApiQuery({
    name: 'glassware',
    required: false,
    description: 'Filter by glass type (e.g., Highball glass, Martini glass)',
  })
  @ApiQuery({
    name: 'excludeIngredients',
    required: false,
    description:
      'Comma-separated ingredient names. Exclude cocktails containing ANY of them.',
  })
  @ApiQuery({
    name: 'ingredientsAny',
    required: false,
    description:
      'Comma-separated ingredient names. Return cocktails containing AT LEAST ONE of them (OR logic).',
  })
  async findAll(
    @Query() paginationQuery: PaginationQueryDto,
    @Query('name') name?: string,
    @Query('fuzzy') fuzzy?: string,
    @Query('includeIngredients') includeIngredients?: string,
    @Query('category') category?: string,
    @Query('glassware') glassware?: string,
    @Query('excludeIngredients') excludeIngredients?: string,
    @Query('ingredientsAny') ingredientsAny?: string,
  ) {
    if (
      name ||
      fuzzy ||
      includeIngredients ||
      category ||
      glassware ||
      excludeIngredients ||
      ingredientsAny
    ) {
      const searchOptions: SearchOptions = {
        fuzzy: fuzzy === 'true',
        includeIngredients: includeIngredients
          ? includeIngredients
              .split(',')
              .map((i) => i.trim())
              .filter(Boolean)
          : undefined,
        excludeIngredients: excludeIngredients
          ? excludeIngredients
              .split(',')
              .map((i) => i.trim())
              .filter(Boolean)
          : undefined,
        ingredientsAny: ingredientsAny
          ? ingredientsAny
              .split(',')
              .map((i) => i.trim())
              .filter(Boolean)
          : undefined,
        filters: {},
      };

      if (category) {
        searchOptions.filters!.category = category;
      }
      if (glassware) {
        searchOptions.filters!.glassType = glassware;
      }

      return this.aggregatorService.searchUnified(
        name || '',
        paginationQuery,
        searchOptions,
      );
    }
    return this.cocktailsService.findAll(paginationQuery);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get local cocktail by ID' })
  findOne(@Param('id') id: string) {
    return this.cocktailsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update a personal cocktail recipe' })
  @ApiConsumes('application/json', 'multipart/form-data')
  @UseInterceptors(
    FileInterceptor('image', {
      // eslint-disable-next-line no-restricted-syntax
      limits: { fileSize: 2 * 1024 * 1024 },
      fileFilter: CocktailsController.IMAGE_FILE_FILTER,
    }),
  )
  async update(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @UploadedFile() file: Express.Multer.File,
    @GetUser() user: User,
  ) {
    let updateCocktailDto: UpdateCocktailDto;

    // Check if we have multipart/form-data with JSON in 'data' field
    if (body && typeof body.data === 'string') {
      try {
        updateCocktailDto = JSON.parse(body.data) as UpdateCocktailDto;
      } catch {
        throw new BadRequestException('Invalid JSON data in form field "data"');
      }
      // Re-validate the parsed JSON through DTO validation
      const instance = plainToInstance(UpdateCocktailDto, updateCocktailDto);
      const errors = await validate(instance, {
        whitelist: true,
        forbidNonWhitelisted: true,
      });
      if (errors.length > 0) {
        const messages = errors.flatMap((e) =>
          Object.values(e.constraints || {}),
        );
        throw new BadRequestException(['Validation failed', ...messages]);
      }
      updateCocktailDto = instance;
    } else {
      // Regular JSON request — validate manually since body is typed as `any`
      const instance = plainToInstance(UpdateCocktailDto, body);
      const errors = await validate(instance, {
        whitelist: true,
        forbidNonWhitelisted: true,
      });
      if (errors.length > 0) {
        const messages = errors.flatMap((e) =>
          Object.values(e.constraints || {}),
        );
        throw new BadRequestException(['Validation failed', ...messages]);
      }
      updateCocktailDto = instance;
    }

    let imagePaths: { full: string | null; thumb: string | null } = {
      full: null,
      thumb: null,
    };

    if (file) {
      imagePaths = await this.imageService.processAndSaveImage(file);
    }

    try {
      return await this.cocktailsService.update(
        id,
        {
          ...updateCocktailDto,
          imageFull: imagePaths.full || undefined,
          imageThumb: imagePaths.thumb || undefined,
        },
        user.id,
      );
    } catch (error) {
      if (imagePaths.full) {
        await fs
          .unlink(path.join(process.cwd(), imagePaths.full))
          .catch(() => {});
      }
      if (imagePaths.thumb) {
        await fs
          .unlink(path.join(process.cwd(), imagePaths.thumb))
          .catch(() => {});
      }
      throw error;
    }
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Delete a personal cocktail recipe' })
  remove(@Param('id') id: string, @GetUser() user: User) {
    return this.cocktailsService.remove(id, user.id);
  }
}
