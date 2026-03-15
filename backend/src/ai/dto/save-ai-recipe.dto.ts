import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SaveAiRecipeDto {
  @ApiProperty({ example: 'Mojito Tropical', description: 'Nombre que el usuario quiere darle a la receta' })
  @IsString()
  @IsNotEmpty()
  name: string;
}
