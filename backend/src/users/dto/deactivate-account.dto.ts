import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class DeactivateAccountDto {
  @ApiProperty({ example: 'MyPassword123', description: 'Current password, to confirm it is really you' })
  @IsString()
  @IsNotEmpty()
  password: string;
}