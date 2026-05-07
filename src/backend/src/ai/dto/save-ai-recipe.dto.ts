import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SaveAiRecipeDto {
  @ApiProperty({
    example: 'Mojito Tropical',
    description: 'Name the user wants to give to the recipe',
  })
  @IsString()
  @IsNotEmpty()
  name: string;
}
