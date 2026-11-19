import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsMongoId, IsString, Length, Matches } from 'class-validator';
import { PASSWORD_MESSAGE, PASSWORD_REGEX } from '../../common/constants/password';
import { Role } from '../../common/enums/role.enum';

export const MODERATOR_ROLES = [Role.AIRLINE_MODERATOR, Role.HOTEL_MODERATOR] as const;

export class CreateModeratorDto {
  @ApiProperty({ example: 'Sara Airline' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 80)
  name: string;

  @ApiProperty({ example: 'sara@egyptair.test' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  email: string;

  @ApiProperty({ enum: MODERATOR_ROLES })
  @IsIn(MODERATOR_ROLES)
  role: Role.AIRLINE_MODERATOR | Role.HOTEL_MODERATOR;

  @ApiProperty({ description: 'Id of the airline (airline_moderator) or hotel (hotel_moderator) this moderator manages' })
  @IsMongoId()
  providerId: string;

  @ApiProperty({ example: 'Temp1234', description: 'Temporary password: 8+ characters, at least one letter and one digit' })
  @IsString()
  @Length(8, 64)
  @Matches(PASSWORD_REGEX, { message: PASSWORD_MESSAGE })
  temporaryPassword: string;
}
