import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ValidateNested, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { RecipeIngredientDto } from './check-makeability.dto';

export class DepleteInventoryDto {
  @ApiProperty({ type: [RecipeIngredientDto], description: 'Ingredients to deplete from inventory' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecipeIngredientDto)
  @IsNotEmpty()
  ingredients: RecipeIngredientDto[];
}