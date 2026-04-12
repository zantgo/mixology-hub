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

  @ApiPropertyOptional({ description: 'Page number (default: 1, max: 100 to prevent database performance degradation)', minimum: 1, maximum: 100, default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100, { message: 'Page number cannot exceed 100 to prevent database performance degradation.' })
  @Type(() => Number)
  page?: number = 1;
}
