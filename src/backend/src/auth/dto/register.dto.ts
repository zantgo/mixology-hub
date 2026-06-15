import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  Validate,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { IsStrongPasswordConstraint } from '../validators/is-strong-password.validator';
import { sanitizeHtml } from '../../common/utils/xss-sanitizer.util';

export class RegisterDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'User email address',
  })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'StrongPassword123!', description: 'User password' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Validate(IsStrongPasswordConstraint)
  password: string;

  @ApiProperty({
    example: 'John Doe',
    description: 'Display name',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Transform(({ value }) =>
    typeof value === 'string' ? sanitizeHtml(value) : value,
  )
  displayName?: string;
}
