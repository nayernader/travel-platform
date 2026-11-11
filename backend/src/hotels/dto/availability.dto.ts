import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsDateString, IsEnum, ValidateNested } from 'class-validator';

export class RangeDto {
  @ApiProperty({ example: '2026-12-01', description: 'First night' }) @IsDateString() start: string;
  @ApiProperty({ example: '2026-12-31', description: 'Check-out day (exclusive)' }) @IsDateString() end: string;
}

export class AddRangeDto extends RangeDto {
  @ApiProperty({ enum: ['AVAILABLE', 'BLOCKED'] }) @IsEnum(['AVAILABLE', 'BLOCKED']) kind: 'AVAILABLE' | 'BLOCKED';
}

export class ReplaceAvailabilityDto {
  @ApiProperty({ type: [RangeDto] }) @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => RangeDto)
  availableRanges: RangeDto[];
}
