import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

import { CabinClass } from '../../flights/schemas/flight.schema';
import { PassengerType } from '../schemas/flight-booking.schema';

export class SegmentDto {
  @ApiProperty({ example: '6aef981ad9d269130f4a57db' })
  @IsMongoId()
  flightId: string;

  @ApiProperty({ enum: CabinClass, example: CabinClass.ECONOMY })
  @IsEnum(CabinClass)
  @Transform(({ value }) =>
  typeof value === 'string'
    ? Object.values(CabinClass).find(
        (c) => c.toLowerCase() === value.trim().toLowerCase(),
      ) ?? value
    : value,
)
@IsEnum(CabinClass)
cabinClass: CabinClass;
  
}

export class PassengerDto {
  @ApiProperty({ example: 'Ahmed Hassan' })
  @IsString()
  @Length(2, 100)
  fullName: string;

  @ApiProperty({ example: '1995-04-12', description: 'Date of birth, YYYY-MM-DD' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'dateOfBirth must look like 1995-04-12' })
  dateOfBirth: string;

  @ApiProperty({ example: 'A12345678', description: 'Passport or ID number' })
  @Matches(/^[A-Za-z0-9]{5,20}$/, {
    message: 'passportNumber must be 5 to 20 letters or digits',
  })
  passportNumber: string;

  @ApiProperty({
    enum: PassengerType,
    example: PassengerType.ADULT,
    description: 'Adult 12+, child 2 to 11, infant under 2. Checked against the date of birth.',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsEnum(PassengerType)
  type: PassengerType;

  @ApiPropertyOptional({ example: 1, description: 'Extra bags beyond the free allowance' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  extraBags?: number;

  @ApiPropertyOptional({ example: 20, description: 'Weight of each extra bag in kg' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  extraBagWeightKg?: number;
}

export class BookingRequestDto {
  @ApiProperty({
    type: [SegmentDto],
    description: '1 segment = one way, 2 segments = round trip (outbound first)',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => SegmentDto)
  segments: SegmentDto[];

  @ApiProperty({ type: [PassengerDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(9)
  @ValidateNested({ each: true })
  @Type(() => PassengerDto)
  passengers: PassengerDto[];
}