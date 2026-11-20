
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, Matches } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({ example: 'test.user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'a1b2c3d4...',
    description: 'Secure verification token from the email link',
  })
  @Matches(/^[a-f0-9]{64}$/i, { message: 'Invalid verification token' })
  token: string;
}
