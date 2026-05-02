import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Request } from '@nestjs/common';
import { AiService } from './ai.service';
import { EnhancedAiService } from './enhanced-ai.service';
import { CreateAiDto } from './dto/create-ai.dto';
import { UpdateAiDto } from './dto/update-ai.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('AI')
@ApiBearerAuth()
@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly enhancedAiService: EnhancedAiService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Generate a new cocktail recipe using AI' })
  create(@Request() req, @Body() createAiDto: CreateAiDto) {
    return this.enhancedAiService.generateRecipe(req.user.id, {
      ingredients: createAiDto.ingredients,
      theme: createAiDto.theme,
      difficulty: createAiDto.difficulty,
      servingSize: createAiDto.servingSize,
      language: createAiDto.language,
    });
  }

  @Post(':id/save-as-cocktail')
  @ApiOperation({ summary: 'Save an AI generated recipe into your local cocktail collection' })
  saveAsCocktail(@Request() req, @Param('id') id: string) {
    return this.enhancedAiService.validateAndSaveRecipe(req.user.id, id);
  }

  @Get()
  @ApiOperation({ summary: 'Get history of AI generated recipes for the user with pagination' })
  findAll(@Request() req, @Query() paginationQuery: PaginationQueryDto) {
    return this.enhancedAiService.getAiRecipeHistory(req.user.id, paginationQuery);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific AI generated recipe by ID' })
  findOne(@Request() req, @Param('id') id: string) {
    return this.aiService.findOne(id, req.user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an AI generated recipe' })
  update(@Request() req, @Param('id') id: string, @Body() updateAiDto: UpdateAiDto) {
    return this.aiService.update(id, updateAiDto, req.user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an AI generated recipe from history' })
  remove(@Request() req, @Param('id') id: string) {
    return this.aiService.remove(id, req.user.id);
  }
}
