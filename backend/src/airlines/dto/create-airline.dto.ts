import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

export class CreateAirlineDto {
  @ApiProperty({ example: 'EgyptAir' })
  @IsString()
  @Length(1, 100)
  name: string;

  @ApiProperty({ example: 'MS', description: 'IATA airline code' })
  @IsString()
  @Matches(/^[A-Za-z0-9]{2,3}$/)
  code: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}

export class UpdateAirlineDto extends PartialType(CreateAirlineDto) {}