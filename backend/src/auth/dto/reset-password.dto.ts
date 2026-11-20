
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, Matches } from 'class-validator';
import { PASSWORD_MESSAGE, PASSWORD_REGEX } from '../../common/constants/password';

export class ResetPasswordDto {
  @ApiProperty({ example: 'test.user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'a1b2c3d4...',
    description: 'Secure password reset token from the email link',
  })
  @Matches(/^[a-f0-9]{64}$/i, { message: 'Invalid reset token' })
  token: string;

  @ApiProperty({ example: 'NewPass1234', description: PASSWORD_MESSAGE })
  @Matches(PASSWORD_REGEX, { message: PASSWORD_MESSAGE })
  newPassword: string;
}
