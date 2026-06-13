import {
  IsUUID,
  IsNumber,
  IsOptional,
  IsString,
  IsDateString,
  Min,
  Max,
  Matches,
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
    description:
      'Expiration date for this inventory batch (must be between years 2000 and 2100)',
  })
  @IsOptional()
  @IsDateString()
  @Matches(/^(20|21)\d\d-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])/, {
    message:
      'Expiration date must be a valid date string between 2000-01-01 and 2100-12-31',
  })
  expirationDate?: string;
}
