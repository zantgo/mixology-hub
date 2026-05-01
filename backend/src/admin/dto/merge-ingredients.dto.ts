import { IsString, IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class MergeIngredientsDto {
  @ApiProperty({ example: 'source-uuid', description: 'Source ingredient ID to merge from' })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  sourceId: string;

  @ApiProperty({ example: 'target-uuid', description: 'Target ingredient ID to merge into' })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  targetId: string;

  @ApiProperty({ example: 'admin-uuid', description: 'Admin user ID performing the merge' })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  adminId: string;
}
