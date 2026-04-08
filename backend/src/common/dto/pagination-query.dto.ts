import { IsOptional, IsPositive, Min, Max, IsString } from 'class-validator';
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

  @ApiPropertyOptional({ description: 'Opaque cursor string for cursor-based pagination' })
  @IsOptional()
  @IsString()
  cursor?: string;
}
