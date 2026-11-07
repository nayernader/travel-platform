import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';

import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { CabinClass } from '../schemas/flight.schema';

export enum FlightSortBy {
  PRICE = 'price',
  DURATION = 'duration',
  DEPARTURE_TIME = 'departureTime',
}
export enum SortOrder {
  ASC = 'ascending',
  DESC = 'descending',
}

export class SearchFlightsDto extends PaginationQueryDto {
  @ApiProperty({ example: 'CAI' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @Length(3, 3)
  departureAirport: string;

  @ApiProperty({ example: 'DXB' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @Length(3, 3)
  arrivalAirport: string;

  @ApiProperty({ example: '2026-12-20', description: 'Local date at the departure airport' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must look like 2026-12-20' })
  date: string;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(9)
  passengers: number = 1;

  @ApiPropertyOptional({ enum: CabinClass })
  @IsOptional()
  @IsEnum(CabinClass)
  cabinClass?: CabinClass;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({ example: 500 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({ enum: FlightSortBy, default: FlightSortBy.DEPARTURE_TIME })
  @IsOptional()
  @IsEnum(FlightSortBy)
  sortBy: FlightSortBy = FlightSortBy.DEPARTURE_TIME;

  @ApiPropertyOptional({ enum: SortOrder, default: SortOrder.ASC })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder: SortOrder = SortOrder.ASC;
}