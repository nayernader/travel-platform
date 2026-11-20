import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsMongoId, Matches, Max, Min, ValidateNested,
} from 'class-validator';

export class SeatAssignmentDto {
  @ApiProperty({ example: 0, description: 'Position of the passenger in the booking (0 = first passenger)' })
  @IsInt()
  @Min(0)
  @Max(8)
  passengerIndex: number;

  @ApiProperty({ example: '12A' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Matches(/^[1-9]\d{0,2}[A-Z]$/, { message: 'seatNumber must look like 12A' })
  seatNumber: string;
}

export class SelectSeatsDto {
  @ApiProperty({ example: '6aef981ad9d269130f4a57db', description: 'One of the booking\'s flights' })
  @IsMongoId()
  flightId: string;

  @ApiProperty({ type: [SeatAssignmentDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(9)
  @ValidateNested({ each: true })
  @Type(() => SeatAssignmentDto)
  assignments: SeatAssignmentDto[];
}