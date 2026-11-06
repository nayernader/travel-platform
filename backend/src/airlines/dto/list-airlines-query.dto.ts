import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class ListAirlinesQueryDto {
  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page: number = 1;

  // GEN-05: page size 10
  @ApiPropertyOptional({ example: 10, default: 10 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50)
  limit: number = 10;

  @ApiPropertyOptional({ description: 'Search by name or code', example: 'egypt' })
  @IsOptional() @IsString() @MaxLength(50)
  search?: string;
}