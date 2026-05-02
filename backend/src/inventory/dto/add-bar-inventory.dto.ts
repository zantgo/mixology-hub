import { IsUUID, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddBarInventoryDto {
  @ApiProperty({ description: 'Ingredient ID to add to bar inventory' })
  @IsUUID()
  ingredientId: string;

  @ApiProperty({ description: 'Quantity to add', minimum: 0 })
  @IsNumber()
  @Min(0)
  quantity: number;

  @ApiPropertyOptional({ description: 'Unit of the quantity (converts to base unit if different)' })
  @IsOptional()
  @IsString()
  unit?: string;
}
