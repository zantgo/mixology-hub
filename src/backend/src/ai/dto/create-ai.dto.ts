import {
  IsArray,
  IsString,
  ArrayNotEmpty,
  IsOptional,
  IsIn,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAiDto {
  @ApiProperty({
    example: ['vodka', 'orange', 'lemon'],
    description:
      'List of ingredients the user wants to use for the AI cocktail',
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  ingredients: string[];

  @ApiProperty({
    example: 'tropical',
    description: 'Optional theme for the cocktail',
    required: false,
  })
  @IsOptional()
  @IsString()
  theme?: string;

  @ApiProperty({
    example: ['sweeter', 'low-alcohol'],
    description:
      'Stylistic modifiers (e.g., sweeter, strong, smoky, tropical, refreshing)',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  modifiers?: string[];

  @ApiProperty({
    example: 'medium',
    description: 'Difficulty level',
    required: false,
    enum: ['easy', 'medium', 'hard'],
  })
  @IsOptional()
  @IsIn(['easy', 'medium', 'hard'])
  difficulty?: 'easy' | 'medium' | 'hard';

  @ApiProperty({
    example: 2,
    description: 'Number of servings',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20)
  servingSize?: number;

  @ApiProperty({
    example: 'en',
    description: 'Language for the recipe',
    required: false,
    enum: ['en', 'es', 'fr', 'de', 'it'],
  })
  @IsOptional()
  @IsIn(['en', 'es', 'fr', 'de', 'it'])
  language?: string;
}
