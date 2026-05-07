import {
  IsUUID,
  IsNumber,
  IsOptional,
  IsString,
  IsDateString,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddBarInventoryDto {
  @ApiProperty({ description: 'Ingredient ID to add to bar inventory' })
  @IsUUID()
  ingredientId: string;

  @ApiProperty({ description: 'Quantity to add', minimum: 0, maximum: 100000 })
  @IsNumber()
  @Min(0)
  @Max(100000, { message: 'Quantity cannot exceed 100,000' })
  quantity: number;

  @ApiPropertyOptional({
    description: 'Unit of the quantity (converts to base unit if different)',
  })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional({
    description: 'Expiration date for this inventory batch',
  })
  @IsOptional()
  @IsDateString()
  expirationDate?: string;
}
