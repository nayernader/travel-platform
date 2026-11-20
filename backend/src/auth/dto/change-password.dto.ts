import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ example: 'OldPass123' })
  @IsString()
  currentPassword: string;

  @ApiProperty({ example: 'NewPass456', description: '8-64 characters, at least one letter and one digit' })
  @IsString()
  @Length(8, 64)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, { message: 'newPassword must contain at least one letter and one digit' })
  newPassword: string;
}
