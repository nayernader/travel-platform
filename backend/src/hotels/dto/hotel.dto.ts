import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsArray, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class CreateHotelDto {
  @ApiProperty({ example: 'Nile View Hotel' }) @IsString() @Length(2, 100) name: string;
  @ApiProperty({ example: '1 Corniche St' }) @IsString() @Length(3, 200) address: string;
  @ApiProperty({ example: 'cairo' }) @IsString() city: string;
  @ApiProperty({ example: 'EG' }) @IsString() country: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional({ type: [String], description: 'URLs from the upload service (GEN-08)' })
  @IsOptional() @IsArray() @IsString({ each: true }) photos?: string[];
  @ApiPropertyOptional({ example: 4 }) @IsOptional() @IsInt() @Min(1) @Max(5) starClass?: number;
  @ApiPropertyOptional({ type: [String], example: ['WiFi', 'Pool'] })
  @IsOptional() @IsArray() @IsString({ each: true }) amenities?: string[];
}
export class UpdateHotelDto extends PartialType(CreateHotelDto) {}
