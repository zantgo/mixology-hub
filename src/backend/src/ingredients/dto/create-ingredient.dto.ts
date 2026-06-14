import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsNumber,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { sanitizeHtml } from '../../common/utils/xss-sanitizer.util';

export class CreateIngredientDto {
  @ApiProperty({
    example: 'vodka',
    description: 'The name of the ingredient (must be unique)',
  })
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) =>
    typeof value === 'string' ? sanitizeHtml(value) : value,
  )
  name: string;

  @ApiProperty({
    example: 'ml',
    description: 'The base unit for this ingredient (ml, g, units)',
    required: false,
  })
  @IsString()
  @IsOptional()
  baseUnit?: string;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description:
      'UUID of the parent ingredient for hierarchical taxonomy (e.g., Bourbon → Whiskey)',
  })
  @IsUUID()
  @IsOptional()
  parentId?: string;

  @ApiPropertyOptional({
    example: 1.0,
    description: 'Density in g/ml for mass-volume conversions (must be > 0)',
  })
  @IsNumber()
  @IsOptional()
  @Min(0.0001)
  @Type(() => Number)
  density?: number;
}
