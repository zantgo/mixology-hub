import { IsString, IsNotEmpty, IsNumber, IsPositive } from 'class-validator';
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

  @ApiProperty({ example: 'ml', description: 'Unit of measurement (ml, oz, pieces)' })
  @IsString()
  @IsNotEmpty()
  unit: string;
}
