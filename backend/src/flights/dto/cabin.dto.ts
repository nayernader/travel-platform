import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNumber, Min } from 'class-validator';
import { CabinClass } from '../schemas/flight.schema';

export class CreateCabinDto {
  @ApiProperty({ enum: CabinClass, example: 'Economy' })
  @IsEnum(CabinClass)
  cabinClass: CabinClass;

  @ApiProperty({ example: 150, description: 'Whole number greater than 0' })
  @IsInt()
  @Min(1)
  totalSeats: number;

  @ApiProperty({ example: 220.5, description: 'Price greater than 0' })
  @IsNumber()
  @Min(0.01)
  price: number;

  @ApiProperty({ example: 1, description: 'Free bags per passenger' })
  @IsInt()
  @Min(0)
  freeBags: number;

  @ApiProperty({ example: 23, description: 'Max weight per bag in kg' })
  @IsNumber()
  @Min(0.1)
  maxBagWeightKg: number;
}