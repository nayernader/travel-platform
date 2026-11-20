import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsMongoId } from 'class-validator';

export class CreatePaymentDto {
  @ApiProperty({ enum: ['flight', 'hotel'] })
  @IsEnum(['flight', 'hotel'])
  bookingType: 'flight' | 'hotel';

  @ApiProperty({ description: 'Id of a Pending Payment booking' })
  @IsMongoId()
  bookingId: string;
}