import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { BookingStatus } from '../../common/enums/booking-status.enum';

export class ListBookingsDto {
  @ApiPropertyOptional({ enum: ['flight', 'hotel'] })
  @IsOptional()
  @IsIn(['flight', 'hotel'])
  type?: 'flight' | 'hotel';

  @ApiPropertyOptional({ enum: BookingStatus })
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @ApiPropertyOptional({ example: '2026-12-01', description: 'Travel date from (flight departure or hotel check-in), inclusive' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-12-31', description: 'Travel date to, inclusive (the whole day)' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;
}
