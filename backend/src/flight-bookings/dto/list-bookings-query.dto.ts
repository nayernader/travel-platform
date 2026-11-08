import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';

export enum BookingGroup {
  UPCOMING = 'upcoming',
  PAST = 'past',
  CANCELLED = 'cancelled',
}

export class ListBookingsQueryDto {
  @ApiPropertyOptional({ enum: BookingGroup, default: BookingGroup.UPCOMING })
  @IsOptional()
  @IsEnum(BookingGroup)
  group: BookingGroup = BookingGroup.UPCOMING;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;
}