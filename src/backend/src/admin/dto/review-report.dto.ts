import { IsString, IsNotEmpty, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReviewReportDto {
  @ApiProperty({
    example: 'resolved',
    description: 'New status for the report',
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['resolved', 'dismissed', 'pending'])
  status: string;

  @ApiProperty({
    example: 'admin-uuid',
    description: 'Admin user ID performing the review',
  })
  @IsString()
  @IsNotEmpty()
  reviewedBy: string;
}
