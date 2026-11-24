import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsMongoId, IsOptional, Min } from 'class-validator';
import { FavouriteType } from '../schemas/favourite.schema';

export class AddFavouriteDto {
  @ApiProperty({ enum: FavouriteType, example: FavouriteType.HOTEL })
  @IsEnum(FavouriteType)
  type: FavouriteType;

  @ApiProperty({ example: '6aee0bb64dc900656809ae9c', description: 'The hotel id or the public itinerary id' })
  @IsMongoId()
  id: string;
}

/** Path parameters of DELETE /favourites/:type/:id */
export class FavouriteParamsDto {
  @IsEnum(FavouriteType)
  type: FavouriteType;

  @IsMongoId()
  id: string;
}

export class ListFavouritesDto {
  @ApiPropertyOptional({ enum: FavouriteType, description: 'Only hotels or only itineraries' })
  @IsOptional()
  @IsEnum(FavouriteType)
  type?: FavouriteType;

  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;
}
