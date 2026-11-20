import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsMongoId, IsString, Length } from 'class-validator';
import { TARGET_TYPES, type TargetType } from '../schemas/report.schema';

export const RESOLVE_ACTIONS = ['dismiss', 'hide', 'delete'] as const;
export type ResolveAction = (typeof RESOLVE_ACTIONS)[number];

export class CreateReportDto {
  @ApiProperty({ enum: TARGET_TYPES })
  @IsIn(TARGET_TYPES)
  targetType: TargetType;

  @ApiProperty({ description: 'The _id of the post, comment, review or itinerary' })
  @IsMongoId()
  targetId: string;

  @ApiProperty({ example: 'Spam or abusive content', description: '3 to 500 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(3, 500)
  reason: string;
}

export class ResolveReportDto {
  @ApiProperty({ enum: RESOLVE_ACTIONS })
  @IsIn(RESOLVE_ACTIONS)
  action: ResolveAction;
}
