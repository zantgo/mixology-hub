import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { AiService } from './ai.service';
import { CreateAiDto } from './dto/create-ai.dto';
import { UpdateAiDto } from './dto/update-ai.dto';
import { SaveAiRecipeDto } from './dto/save-ai-recipe.dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

@ApiTags('AI')
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post()
  @ApiOperation({ summary: 'Generate a new cocktail recipe using AI' })
  create(@Body() createAiDto: CreateAiDto) {
    return this.aiService.generateRecipe(createAiDto);
  }

  @Post(':id/save-as-cocktail')
  @ApiOperation({ summary: 'Save an AI generated recipe into your local cocktail collection' })
  saveAsCocktail(@Param('id') id: string, @Body() saveDto: SaveAiRecipeDto) {
    return this.aiService.saveAsCocktail(id, saveDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get history of AI generated recipes for the user with pagination' })
  findAll(@Query() paginationQuery: PaginationQueryDto) {
    return this.aiService.findAll(paginationQuery);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific AI generated recipe by ID' })
  findOne(@Param('id') id: string) {
    return this.aiService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an AI generated recipe' })
  update(@Param('id') id: string, @Body() updateAiDto: UpdateAiDto) {
    return this.aiService.update(id, updateAiDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an AI generated recipe from history' })
  remove(@Param('id') id: string) {
    return this.aiService.remove(id);
  }
}
