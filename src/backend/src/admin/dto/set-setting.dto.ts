import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SetSettingDto {
  @ApiProperty({
    example: 'max_ai_recipes_per_day',
    description: 'Setting key name',
  })
  @IsString()
  @IsNotEmpty()
  key: string;

  @ApiProperty({ example: '50', description: 'Setting value' })
  @IsString()
  @IsNotEmpty()
  value: string;

  @ApiProperty({
    example: 'admin-uuid',
    description: 'Admin user ID performing the update',
  })
  @IsString()
  @IsNotEmpty()
  updatedBy: string;
}
