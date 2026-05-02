import { IsString, IsNotEmpty, IsNumber, IsPositive, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddInventoryDto {
  @ApiProperty({ example: 'uuid-of-ingredient', description: 'Ingredient ID from catalog' })
  @IsString()
  @IsNotEmpty()
  ingredientId: string;

  @ApiProperty({ example: 500, description: 'Quantity the user currently has' })
  @IsNumber()
  @IsPositive()
  quantity: number;

  @ApiProperty({ example: 'ml', description: 'Unit of measurement (ml, oz, g, count, etc.)' })
  @IsString()
  @IsNotEmpty()
  @IsIn(['ml', 'oz', 'l', 'cl', 'tbsp', 'tsp', 'dash', 'dashes', 'count', 'g', 'kg', 'parts', 'part', 'drops', 'drop', 'splashes', 'splash', 'slices', 'slice', 'wedges', 'wedge', 'twists', 'twist', 'sprigs', 'sprig', 'leaves', 'leaf'])
  unit: string;
}
