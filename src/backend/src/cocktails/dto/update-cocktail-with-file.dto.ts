import { PartialType } from '@nestjs/mapped-types';
import { CreateCocktailWithFileDto } from './create-cocktail-with-file.dto';

export class UpdateCocktailWithFileDto extends PartialType(
  CreateCocktailWithFileDto,
) {}
