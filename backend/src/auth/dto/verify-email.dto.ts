import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, Matches } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({ example: 'test.user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '482913', description: '6-digit code from the verification email' })
  @Matches(/^\d{6}$/, { message: 'The code must be exactly 6 digits' })
  code: string;
}