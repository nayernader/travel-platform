import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNumber,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class TierDto {
  @ApiProperty({ example: 7, description: 'Days before departure (integer, 0 or more)' })
  @IsInt()
  @Min(0)
  daysBefore: number;

  @ApiProperty({ example: 50, description: 'Refund percentage from 0 to 100' })
  @IsNumber()
  @Min(0)
  @Max(100)
  refundPercent: number;
}

export class CancellationPolicyDto {
  @ApiProperty({
    type: [TierDto],
    example: [
      { daysBefore: 14, refundPercent: 100 },
      { daysBefore: 7, refundPercent: 50 },
      { daysBefore: 0, refundPercent: 0 },
    ],
  })
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => TierDto)
  tiers: TierDto[];
}