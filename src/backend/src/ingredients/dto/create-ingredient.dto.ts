import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateIngredientDto {
  @ApiProperty({
    example: 'vodka',
    description: 'The name of the ingredient (must be unique)',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: 'ml',
    description: 'The base unit for this ingredient (ml, g, units)',
    required: false,
  })
  @IsString()
  @IsOptional()
  baseUnit?: string;
}
