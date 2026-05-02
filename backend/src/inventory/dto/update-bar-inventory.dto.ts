import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateBarInventoryDto {
  @ApiProperty({ description: 'New quantity (absolute value)', minimum: 0 })
  @IsNumber()
  @Min(0)
  quantity: number;

  @ApiPropertyOptional({ description: 'Unit of the quantity (converts to base unit if different)' })
  @IsOptional()
  @IsString()
  unit?: string;
}
