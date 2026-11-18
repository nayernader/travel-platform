import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { Transform, TransformFnParams, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Length, Matches, Min } from 'class-validator';
import { SearchHotelsDto } from '../../hotels/dto/search-hotels.dto';
import { SearchFlightsDto } from '../../flights/dto/search-flights.dto';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const upper = ({ value }: TransformFnParams) => (typeof value === 'string' ? value.trim().toUpperCase() : value);

/**
 * ITN-25: hotels for one city group of my itinerary. The city and the dates come from the
 * itinerary, so everything else is the normal hotel search (HTL-11).
 */
export class ItineraryHotelsQueryDto extends OmitType(SearchHotelsDto, [
  'city',
  'country',
  'checkIn',
  'checkOut',
] as const) {
  @ApiProperty({ example: 1, description: 'Which city group: 1 = the first entry of "groups" in the itinerary' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  group: number;
}

export enum TripType {
  ONE_WAY = 'one-way',
  ROUND_TRIP = 'round-trip',
}

/**
 * ITN-26: flights from an origin airport to any airport in the city of the itinerary's first day.
 * Filters, sorting and paging are the normal flight search (FLT-11, FLT-12).
 */
export class ItineraryFlightsQueryDto extends OmitType(SearchFlightsDto, [
  'departureAirport',
  'arrivalAirport',
  'date',
  'returnDate',
] as const) {
  @ApiProperty({ example: 'CAI', description: 'Airport you fly from (3-letter code)' })
  @Transform(upper)
  @IsString()
  @Length(3, 3)
  originAirport: string;

  @ApiPropertyOptional({ enum: TripType, default: TripType.ONE_WAY })
  @IsOptional()
  @IsEnum(TripType)
  tripType: TripType = TripType.ONE_WAY;

  @ApiPropertyOptional({ example: '2026-12-20', description: 'Outbound date. Default: the itinerary start date' })
  @IsOptional()
  @Matches(DAY, { message: 'date must look like 2026-12-20' })
  date?: string;

  @ApiPropertyOptional({
    example: '2026-12-27',
    description: 'Round trip only. Default: the date of the last day of the itinerary',
  })
  @IsOptional()
  @Matches(DAY, { message: 'returnDate must look like 2026-12-27' })
  returnDate?: string;
}
