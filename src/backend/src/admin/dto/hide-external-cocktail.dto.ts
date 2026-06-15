import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class HideExternalCocktailDto {
  @ApiProperty({
    example: '11007',
    description: 'External cocktail ID from TheCocktailDB',
  })
  @IsString()
  @IsNotEmpty()
  externalId: string;

  @ApiProperty({
    example: 'Inappropriate content',
    description: 'Reason for hiding the cocktail',
  })
  @IsString()
  @IsNotEmpty()
  reason: string;
}
