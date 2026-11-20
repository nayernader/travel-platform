import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, IsNumber, IsOptional, Matches, Max, Min, ValidateNested } from 'class-validator';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export class TierDto {
  @ApiProperty({ example: 3, description: 'Days before check-in' }) @IsInt() @Min(0) daysBefore: number;
  @ApiProperty({ example: 100 }) @IsNumber() @Min(0) @Max(100) refundPercent: number;
}
export class PoliciesDto {
  @ApiPropertyOptional({ example: '14:00' }) @IsOptional() @Matches(TIME, { message: 'use HH:mm' }) checkInTime?: string;
  @ApiPropertyOptional({ example: '12:00' }) @IsOptional() @Matches(TIME, { message: 'use HH:mm' }) checkOutTime?: string;
  @ApiPropertyOptional({ type: [TierDto] }) @IsOptional() @IsArray() @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => TierDto)
  cancellationTiers?: TierDto[];
}
