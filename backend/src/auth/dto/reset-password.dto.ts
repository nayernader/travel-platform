import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, Matches } from 'class-validator';
import { PASSWORD_MESSAGE, PASSWORD_REGEX } from '../../common/constants/password';

export class ResetPasswordDto {
  @ApiProperty({ example: 'test.user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '482913', description: '6-digit code from the reset email' })
  @Matches(/^\d{6}$/, { message: 'The code must be exactly 6 digits' })
  code: string;

  @ApiProperty({ example: 'NewPass1234', description: PASSWORD_MESSAGE })
  @Matches(PASSWORD_REGEX, { message: PASSWORD_MESSAGE })
  newPassword: string;
}