import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import { ArrayMinSize, ArrayUnique, IsArray, IsDateString, IsString, Length, Matches } from 'class-validator';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const trim = ({ value }: TransformFnParams) => (typeof value === 'string' ? value.trim() : value);
const upperEach = ({ value }: TransformFnParams) =>
  Array.isArray(value) ? value.map((v) => (typeof v === 'string' ? v.trim().toUpperCase() : v)) : value;

export class CreateItineraryDto {
  @ApiProperty({ example: 'Dubai and Cairo trip', description: 'Required, 1 to 100 characters' })
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  title: string;

  @ApiProperty({ example: ['AE', 'EG'], description: 'Country ids from the predefined list (at least one)' })
  @Transform(upperEach)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsString({ each: true })
  countries: string[];

  @ApiProperty({ example: '2026-12-20', description: 'YYYY-MM-DD' })
  @Matches(DAY, { message: 'startDate must look like 2026-12-20' })
  @IsDateString({ strict: true })
  startDate: string;
}

export class UpdateItineraryDto extends PartialType(CreateItineraryDto) {}