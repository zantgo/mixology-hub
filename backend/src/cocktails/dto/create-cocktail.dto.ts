import { IsString, IsNotEmpty, IsOptional, IsArray, ValidateNested, IsNumber, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for the ingredient structure within a cocktail creation.
 * We include both 'amount/unit' for math/logic and 'measure' for display.
 */
class CreateCocktailIngredientDto {
  @ApiProperty({ example: 'uuid-of-ingredient', description: 'Ingredient ID from catalog' })
  @IsString()
  @IsNotEmpty()
  ingredientId: string;

  @ApiProperty({ example: 2, description: 'Numeric amount for inventory logic/calculation' })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({ example: 'oz', description: 'Unit used for calculation (ml, oz, grams)' })
  @IsString()
  @IsNotEmpty()
  unit: string;

  @ApiProperty({ example: '2 oz', description: 'Full string for display purposes (UI label)' })
  @IsString()
  @IsNotEmpty()
  measure: string;
}

/**
 * DTO for creating a new cocktail recipe.
 */
export class CreateCocktailDto {
  @ApiProperty({ example: 'Mojito', description: 'Name of the cocktail' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'A refreshing mint drink', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 'Mix all ingredients with ice.', description: 'Step by step instructions' })
  @IsString()
  @IsNotEmpty()
  instructions: string;

  @ApiProperty({ type: [CreateCocktailIngredientDto], description: 'List of ingredients with measurements' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCocktailIngredientDto)
  ingredients: CreateCocktailIngredientDto[];
}
