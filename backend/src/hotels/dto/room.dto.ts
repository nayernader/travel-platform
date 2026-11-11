import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, IsString, Length, Min } from 'class-validator';

export class CreateRoomDto {
  @ApiProperty({ example: '101' }) @IsString() @Length(1, 30) roomNumber: string;
  @ApiProperty({ example: 'Double' }) @IsString() @Length(2, 50) type: string;
  @ApiProperty({ example: 2 }) @IsInt() @Min(1) beds: number;
  @ApiProperty({ example: 2 }) @IsInt() @Min(1) maxOccupancy: number;
  @ApiProperty({ example: 120 }) @IsNumber() @Min(0.01) pricePerNight: number;
}
export class UpdateRoomDto {
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) beds?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) maxOccupancy?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0.01) pricePerNight?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 50) type?: string;
}
