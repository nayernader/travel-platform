import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { PostStatus } from '../schemas/post.schema';

/** BLG-08: at most 5 tags, each at most 30 characters. Lowercased and de-duplicated. */
const cleanTags = ({ value }: { value: unknown }) =>
  Array.isArray(value)
    ? [...new Set(value.map((t) => String(t).trim().toLowerCase()).filter(Boolean))]
    : value;

export class CreatePostDto {
  @ApiProperty({ example: 'Three days in Dubai' })
  @IsString()
  @Length(1, 150)
  title: string;

  @ApiProperty({ example: 'It was great' })
  @IsString()
  @Length(1, 20000)
  body: string;

  @ApiPropertyOptional({ type: [String], example: ['dubai', 'budget'], description: 'Up to 5 tags, 30 characters each' })
  @IsOptional()
  @Transform(cleanTags)
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  tags?: string[];

  @ApiPropertyOptional({ enum: PostStatus, default: PostStatus.DRAFT, description: 'DRAFT or PUBLISHED' })
  @IsOptional()
  @IsEnum(PostStatus)
  status?: PostStatus;
}

export class UpdatePostDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 150)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 20000)
  body?: string;

  @ApiPropertyOptional({ type: [String], description: 'Replaces all tags. Up to 5, 30 characters each' })
  @IsOptional()
  @Transform(cleanTags)
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  tags?: string[];

  @ApiPropertyOptional({ enum: PostStatus })
  @IsOptional()
  @IsEnum(PostStatus)
  status?: PostStatus;
}

/** BLG-13: attach one of my public itineraries to my post, or send null to detach it. */
export class AttachItineraryDto {
  @ApiProperty({
    example: '6a0000000000000000000001',
    nullable: true,
    type: String,
    description: 'Id of one of my PUBLIC itineraries, or null to remove the attached itinerary',
  })
  @ValidateIf((o: AttachItineraryDto) => o.itineraryId !== null)
  @IsMongoId({ message: 'itineraryId must be a valid id or null' })
  itineraryId: string | null;
}
