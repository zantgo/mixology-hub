import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  UseInterceptors,
  Request,
} from '@nestjs/common';
import { AiRecipeService } from './ai.service';
import { CreateAiDto } from './dto/create-ai.dto';
import { UpdateAiDto } from './dto/update-ai.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AiAuditInterceptor } from './interceptors/ai-audit.interceptor';

@ApiTags('AI')
@ApiBearerAuth()
@Controller('ai')
@UseGuards(JwtAuthGuard)
@UseInterceptors(AiAuditInterceptor)
export class AiController {
  constructor(private readonly aiService: AiRecipeService) {}

  @Post()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Generate a new cocktail recipe using AI' })
  create(@Request() req, @Body() createAiDto: CreateAiDto) {
    return this.aiService.generateRecipe(req.user.id, {
      ingredients: createAiDto.ingredients,
      theme: createAiDto.theme,
      modifiers: createAiDto.modifiers,
      difficulty: createAiDto.difficulty,
      servingSize: createAiDto.servingSize,
      language: createAiDto.language,
    });
  }

  @Patch(':id/regenerate')
  @ApiOperation({ summary: 'Regenerate a new AI recipe from the same prompt' })
  regenerate(@Request() req, @Param('id') id: string) {
    return this.aiService.regenerateRecipe(req.user.id, id);
  }

  @Post(':id/save-as-cocktail')
  @ApiOperation({
    summary: 'Save an AI generated recipe into your local cocktail collection',
  })
  saveAsCocktail(@Request() req, @Param('id') id: string) {
    return this.aiService.validateAndSaveRecipe(req.user.id, id);
  }

  @Get()
  @ApiOperation({
    summary: 'Get history of AI generated recipes for the user with pagination',
  })
  findAll(@Request() req, @Query() paginationQuery: PaginationQueryDto) {
    return this.aiService.getAiRecipeHistory(req.user.id, paginationQuery);
  }

  @Get('quota')
  @ApiOperation({ summary: 'Get remaining daily AI quota for the user' })
  getQuota(@Request() req) {
    return this.aiService.getQuotaStatus(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific AI generated recipe by ID' })
  findOne(@Request() req, @Param('id') id: string) {
    return this.aiService.findOne(id, req.user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an AI generated recipe' })
  update(
    @Request() req,
    @Param('id') id: string,
    @Body() updateAiDto: UpdateAiDto,
  ) {
    return this.aiService.update(id, updateAiDto, req.user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an AI generated recipe from history' })
  remove(@Request() req, @Param('id') id: string) {
    return this.aiService.remove(id, req.user.id);
  }
}
