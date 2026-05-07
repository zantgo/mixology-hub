import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min, Max } from 'class-validator';

export class RateCocktailDto {
  @ApiProperty({ description: 'Rating score from 1 to 5', example: 4 })
  @IsInt()
  @Min(1)
  @Max(5)
  score: number;
}
