import { IsString, IsNotEmpty, IsOptional, IsArray, ValidateNested, IsNumber, IsPositive, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

const ALLOWED_UNITS = ['ml', 'oz', 'l', 'cl', 'tbsp', 'tsp', 'dash', 'dashes', 'count', 'g', 'kg', 'parts', 'part', 'drops', 'drop', 'splashes', 'splash', 'slices', 'slice', 'wedges', 'wedge', 'twists', 'twist', 'sprigs', 'sprig', 'leaves', 'leaf'];

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
  @IsIn(ALLOWED_UNITS)
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



  @ApiProperty({
    example: true,
    description: 'Whether the cocktail is publicly visible to other users',
    required: false,
    default: true
  })
  @IsOptional()
  isPublic?: boolean;

  @ApiProperty({
    example: '11000',
    description: 'Original external cocktail ID when forking from TheCocktailDB (UC 2.22 lineage tracking)',
    required: false,
  })
  @IsOptional()
  @IsString()
  parentExternalId?: string;
}
