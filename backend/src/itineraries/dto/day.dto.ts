import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

// City ids in the reference data are lowercase, e.g. "cairo"
const cityId = ({ value }: TransformFnParams) => (typeof value === 'string' ? value.trim().toLowerCase() : value);

export class AddDayDto {
  @ApiProperty({ example: 'dubai', description: 'City id from the predefined list (required)' })
  @Transform(cityId)
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiPropertyOptional({ example: 'Arrive and check in' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class UpdateDayDto {
  @ApiPropertyOptional({ example: 'cairo' })
  @IsOptional()
  @Transform(cityId)
  @IsString()
  @IsNotEmpty()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class ReorderDayDto {
  @ApiProperty({ description: 'The day _id to move' })
  @IsString()
  @IsNotEmpty()
  dayId: string;

  @ApiProperty({ example: 1, description: 'New position, starting at 1' })
  @IsInt()
  @Min(1)
  position: number;
}