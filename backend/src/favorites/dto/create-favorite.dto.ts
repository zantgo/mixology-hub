import { IsString, IsOptional, ValidateIf } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateFavoriteDto {
  @ApiProperty({ required: false, description: 'Local Cocktail UUID' })
  @ValidateIf(o => !o.externalCocktailId) // Only validate if externalCocktailId is not provided
  @IsString()
  cocktailId?: string;

  @ApiProperty({ required: false, description: 'External API Cocktail ID' })
  @ValidateIf(o => !o.cocktailId) // Only validate if cocktailId is not provided
  @IsString()
  externalCocktailId?: string;
}
