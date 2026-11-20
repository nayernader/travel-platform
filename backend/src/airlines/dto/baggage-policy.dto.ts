import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNumber, Min } from 'class-validator';

export class BaggagePolicyDto {
  @ApiProperty({ example: 25, description: 'Price per extra bag, greater than 0' })
  @IsNumber()
  @Min(0.01)
  pricePerExtraBag: number;

  @ApiProperty({ example: 2, description: 'Max extra bags per passenger, 0 or more' })
  @IsInt()
  @Min(0)
  maxExtraBags: number;
}