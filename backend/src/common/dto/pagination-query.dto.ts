import { IsOptional, IsPositive, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Number of items to return (default: 10)', minimum: 1, default: 10 })
  @IsOptional()
  @IsPositive()
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional({ description: 'Number of items to skip (default: 0)', minimum: 0, default: 0 })
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  offset?: number;
}
