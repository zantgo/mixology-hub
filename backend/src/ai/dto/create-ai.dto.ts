import { IsArray, IsString, ArrayNotEmpty } from 'class-validator';

export class CreateAiDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  ingredients: string[];
}
