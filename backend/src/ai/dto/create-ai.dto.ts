import { IsArray, IsString, ArrayNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAiDto {
  @ApiProperty({ 
    example:['vodka', 'naranja', 'limón'], 
    description: 'List of ingredients the user wants to use for the AI cocktail' 
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  ingredients: string[];
}
