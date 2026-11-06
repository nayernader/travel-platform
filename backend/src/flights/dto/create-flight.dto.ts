import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

const LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export class CreateFlightDto {
  @ApiProperty({ example: 'MS777' }) @IsString() @Length(3, 8) flightNumber: string;
  @ApiProperty({ example: 'CAI' }) @IsString() @Length(3, 3) departureAirport: string;
  @ApiProperty({ example: 'DXB' }) @IsString() @Length(3, 3) arrivalAirport: string;
  @ApiProperty({ example: '2026-12-20T10:30', description: 'Local time at the departure airport' })
  @Matches(LOCAL, { message: 'departureLocal must look like 2026-12-20T10:30' }) departureLocal: string;
  @ApiProperty({ example: '2026-12-20T14:45', description: 'Local time at the arrival airport' })
  @Matches(LOCAL, { message: 'arrivalLocal must look like 2026-12-20T14:45' }) arrivalLocal: string;
}