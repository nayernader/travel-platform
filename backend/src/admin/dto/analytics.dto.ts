import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, Min } from 'class-validator';

export class AnalyticsQueryDto {
  @ApiPropertyOptional({
    example: '2026-11-01',
    description: 'Start of the period (the date the booking was made). Default: 30 days before "to".',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    example: '2026-11-30',
    description: 'End of the period. A date without a time covers the whole day. Default: now.',
  })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ enum: ['flight', 'hotel'], description: 'Only airlines (flight) or only hotels (hotel)' })
  @IsOptional()
  @IsIn(['flight', 'hotel'])
  type?: 'flight' | 'hotel';

  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;
}
