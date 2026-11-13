import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsMongoId,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class RoomGuestsDto {
  @ApiProperty()
  @IsMongoId()
  roomId: string;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(0)
  @Max(10)
  adults: number;

  @ApiProperty({ example: [5, 9], description: 'Ages 0-17' })
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(17, { each: true })
  childAges: number[];
}

export class CreateHotelBookingDto {
  @ApiProperty()
  @IsMongoId()
  hotelId: string;

  @ApiProperty({ example: '2026-12-20' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  checkIn: string;

  @ApiProperty({ example: '2026-12-23' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  checkOut: string;

  @ApiProperty({ type: [RoomGuestsDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => RoomGuestsDto)
  rooms: RoomGuestsDto[];
}
