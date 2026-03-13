import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { AiService } from './ai.service';
import { CreateAiDto } from './dto/create-ai.dto';
import { UpdateAiDto } from './dto/update-ai.dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('AI')
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post()
  @ApiOperation({ summary: 'Generate a new cocktail recipe using AI' })
  create(@Body() createAiDto: CreateAiDto) {
    return this.aiService.generateRecipe(createAiDto);
  }

  @Get()
  findAll() {
    return this.aiService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.aiService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateAiDto: UpdateAiDto) {
    return this.aiService.update(id, updateAiDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.aiService.remove(id);
  }
}
