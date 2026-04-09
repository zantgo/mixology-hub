import { IsString, IsNotEmpty, IsOptional, IsArray, ValidateNested, IsNumber, IsPositive, IsUrl } from 'class-validator';
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

  @ApiProperty({ 
    example: 'https://www.thecocktaildb.com/images/media/drink/2x8thr1504816928.jpg', 
    description: 'URL to cocktail image (optional, will use default if not provided or invalid)',
    required: false 
  })
  @IsString()
  @IsOptional()
  @IsUrl({ require_protocol: true }, { message: 'imageUrl must be a valid URL with protocol (http:// or https://)' })
  imageUrl?: string;

  @ApiProperty({ 
    example: true, 
    description: 'Whether the cocktail is publicly visible to other users',
    required: false,
    default: true 
  })
  @IsOptional()
  isPublic?: boolean;
}
