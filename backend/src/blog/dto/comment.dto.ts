import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

export class CommentDto {
  @ApiProperty({ example: 'Great tips!', description: 'Non-empty, at most 500 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value)) // spaces only -> empty -> 400
  @IsString()
  @Length(1, 500)
  text: string;
}
