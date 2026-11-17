import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, TransformFnParams, Type } from 'class-transformer';
import { IsIn, IsMongoId, IsNumber, IsOptional, IsString, Length, MaxLength, Min } from 'class-validator';
import { SUPPORTED_CURRENCIES } from '../../common/constants/currencies';
import { BudgetCategory } from '../schemas/itinerary.schema';

const trim = ({ value }: TransformFnParams) => (typeof value === 'string' ? value.trim() : value);
const cityId = ({ value }: TransformFnParams) => (typeof value === 'string' ? value.trim().toLowerCase() : value);

/** ITN-14: one budget entry for one day. */
export class CreateBudgetDto {
  @ApiProperty({ enum: Object.values(BudgetCategory), example: 'food', description: 'transport means in-city transport' })
  @IsIn(Object.values(BudgetCategory))
  category: BudgetCategory;

  @ApiProperty({ example: 25, description: 'Non-negative amount' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({ enum: SUPPORTED_CURRENCIES, example: 'USD' })
  @IsIn([...SUPPORTED_CURRENCIES])
  currency: string;

  @ApiPropertyOptional({ example: 'Dinner at the marina' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  note?: string;
}

export class UpdateBudgetDto extends PartialType(CreateBudgetDto) {}

/** ITN-16: intercity transport cost, attached to one day of the itinerary. */
export class CreateTransportCostDto {
  @ApiProperty({ example: 'train', description: 'Free text: train, bus, flight, car, ferry...' })
  @Transform(trim)
  @IsString()
  @Length(1, 50)
  mode: string;

  @ApiProperty({ example: 'cairo', description: 'City id from the shared city list' })
  @Transform(cityId)
  @IsString()
  @Length(1, 60)
  fromCity: string;

  @ApiProperty({ example: 'dubai', description: 'City id from the shared city list' })
  @Transform(cityId)
  @IsString()
  @Length(1, 60)
  toCity: string;

  @ApiProperty({ example: 120 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({ enum: SUPPORTED_CURRENCIES, example: 'USD' })
  @IsIn([...SUPPORTED_CURRENCIES])
  currency: string;

  @ApiProperty({ description: 'Id of the day of this itinerary the trip belongs to' })
  @IsMongoId()
  dayId: string;
}

export class UpdateTransportCostDto extends PartialType(CreateTransportCostDto) {}