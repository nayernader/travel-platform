import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsMongoId } from 'class-validator';
import { AttachedBookingType } from '../schemas/itinerary.schema';

export class AttachBookingDto {
  @ApiProperty({ enum: AttachedBookingType, example: 'flight' })
  @IsEnum(AttachedBookingType)
  type: AttachedBookingType;

  @ApiProperty({ example: '6afca31b20e906f06aa53325', description: 'Id of your confirmed booking' })
  @IsMongoId()
  bookingId: string;
}