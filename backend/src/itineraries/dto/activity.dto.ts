import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, TransformFnParams, Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, Length, Matches, MaxLength, Min } from 'class-validator';
import { SUPPORTED_CURRENCIES } from '../../common/constants/currencies';

const trim = ({ value }: TransformFnParams) => (typeof value === 'string' ? value.trim() : value);

export class CreateActivityDto {
  @ApiProperty({ example: 'Burj Khalifa visit' })
  @Transform(trim)
  @IsString()
  @Length(1, 120)
  name: string;

  @ApiPropertyOptional({ example: 'Sunset tickets for the observation deck' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ example: '10:30', description: 'HH:mm, optional' })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'time must be HH:mm' })
  time?: string;

  @ApiPropertyOptional({ example: 40, description: 'Optional cost, counted under Activities in the budget' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cost?: number;

  @ApiPropertyOptional({ enum: SUPPORTED_CURRENCIES, example: 'USD', default: 'USD' })
  @IsOptional()
  @IsIn([...SUPPORTED_CURRENCIES])
  costCurrency?: string;
}

export class UpdateActivityDto extends PartialType(CreateActivityDto) {}