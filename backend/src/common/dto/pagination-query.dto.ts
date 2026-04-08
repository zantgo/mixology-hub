import { IsOptional, IsPositive, Min, Max, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Number of items to return (default: 10, max: 100)', minimum: 1, maximum: 100, default: 10 })
  @IsOptional()
  @IsPositive()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 10;

  @ApiPropertyOptional({ description: 'Number of items to skip (for offset-based pagination)', minimum: 0, default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  offset?: number = 0;

  @ApiPropertyOptional({ description: 'Opaque cursor string for cursor-based pagination' })
  @IsOptional()
  @IsString()
  cursor?: string;
}
