import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class ReportCocktailDto {
  @ApiProperty({ description: 'Reason for reporting', example: 'Inappropriate content' })
  @IsString()
  @IsNotEmpty()
  reportReason: string;

  @ApiProperty({ description: 'Additional details', required: false })
  @IsString()
  @IsOptional()
  details?: string;
}
