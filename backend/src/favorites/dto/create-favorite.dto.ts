import { IsString, IsOptional, ValidateIf } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateFavoriteDto {
  @ApiProperty({ required: false, description: 'Local Cocktail UUID' })
  @ValidateIf(o => !o.externalCocktailId) // Solo validar si no viene el externo
  @IsString()
  cocktailId?: string;

  @ApiProperty({ required: false, description: 'External API Cocktail ID' })
  @ValidateIf(o => !o.cocktailId) // Solo validar si no viene el local
  @IsString()
  externalCocktailId?: string;
}
