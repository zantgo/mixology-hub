import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { sanitizeHtml } from '../../common/utils/xss-sanitizer.util';

export class ReportCocktailDto {
  @ApiProperty({
    description: 'Reason for reporting',
    example: 'Inappropriate content',
  })
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) =>
    typeof value === 'string' ? sanitizeHtml(value) : value,
  )
  reportReason: string;

  @ApiProperty({ description: 'Additional details', required: false })
  @IsString()
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? sanitizeHtml(value) : value,
  )
  details?: string;
}
