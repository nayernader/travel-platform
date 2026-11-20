import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';

export const SUPPORTED_CURRENCIES = ['EGP', 'AED', 'GBP', 'USD', 'EUR', 'JPY', 'SAR'];

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Nayer Nader' })
  @IsOptional()
  @IsString()
  @Length(2, 80)
  name?: string;

  @ApiPropertyOptional({ example: '+201001234567' })
  @IsOptional()
  @Matches(/^\+?[0-9]{7,15}$/, { message: 'phone must be 7-15 digits, optionally starting with +' })
  phone?: string;

  @ApiPropertyOptional({ enum: SUPPORTED_CURRENCIES, example: 'EGP' })
  @IsOptional()
  @IsIn(SUPPORTED_CURRENCIES)
  preferredCurrency?: string;
}
