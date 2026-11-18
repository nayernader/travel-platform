import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, TransformFnParams, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Length, Min } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

const trim = ({ value }: TransformFnParams) => (typeof value === 'string' ? value.trim() : value);
const upper = ({ value }: TransformFnParams) => (typeof value === 'string' ? value.trim().toUpperCase() : value);
const lower = ({ value }: TransformFnParams) => (typeof value === 'string' ? value.trim().toLowerCase() : value);

export class SearchPublicItinerariesDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'dubai', description: 'Keyword matching the title, a country name or a city name' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  q?: string;

  @ApiPropertyOptional({ example: 'AE', description: 'Country id' })
  @IsOptional()
  @Transform(upper)
  @IsString()
  country?: string;

  @ApiPropertyOptional({ example: 'dubai', description: 'City id' })
  @IsOptional()
  @Transform(lower)
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 3, description: 'Minimum number of days' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minDays?: number;

  @ApiPropertyOptional({ example: 10, description: 'Maximum number of days' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxDays?: number;
}