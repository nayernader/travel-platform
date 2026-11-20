import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum } from 'class-validator';
import { CabinClass } from '../schemas/flight.schema';

export class SeatMapQueryDto {
  @ApiProperty({ enum: CabinClass, example: CabinClass.ECONOMY })
  @Transform(({ value }) =>
    typeof value === 'string'
      ? Object.values(CabinClass).find((c) => c.toLowerCase() === value.trim().toLowerCase()) ?? value
      : value,
  )
  @IsEnum(CabinClass)
  cabinClass: CabinClass;
}