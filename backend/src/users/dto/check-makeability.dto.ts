import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, ValidateNested, IsNumber, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class RecipeIngredientDto {
  @ApiProperty({ example: 'ingredient-123', description: 'ID of the required ingredient' })
  @IsString()
  @IsNotEmpty()
  ingredientId: string;

  @ApiProperty({ example: 50, description: 'Amount required' })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({ example: 'ml', description: 'Unit of measurement' })
  @IsString()
  @IsNotEmpty()
  unit: string;
}

export class CheckMakeabilityDto {
  @ApiProperty({ type: [RecipeIngredientDto], description: 'List of ingredients required for the recipe' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecipeIngredientDto)
  ingredients: RecipeIngredientDto[];
}