import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Auth } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';
import type { UserDocument } from '../users/schemas/user.schema';
import { AddFavouriteDto, FavouriteParamsDto, ListFavouritesDto } from './dto/favourites.dto';
import { FavouriteType } from './schemas/favourite.schema';
import { FavouritesService } from './favourites.service';

@ApiTags('Favourites')
@Auth(Role.USER)
@Controller('favourites')
export class FavouritesController {
  constructor(private readonly favourites: FavouritesService) {}

  @Post()
  @ApiOperation({
    summary: 'Save a hotel or a public itinerary to my favourites (BON-02)',
    description: 'BON-02. Only active hotels and public, non-hidden itineraries. 409 ALREADY_FAVOURITE if already saved.',
  })
  add(@CurrentUser() user: UserDocument, @Body() dto: AddFavouriteDto) {
    return this.favourites.add(user, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'My favourites, newest first (BON-02)',
    description: 'BON-02. Paginated by 10. "available" is false when a hotel was deactivated or an itinerary is no longer public.',
  })
  list(@CurrentUser() user: UserDocument, @Query() query: ListFavouritesDto) {
    return this.favourites.list(user, query);
  }

  @Delete(':type/:id')
  @ApiOperation({ summary: 'Remove an item from my favourites (BON-02)', description: 'BON-02' })
  @ApiParam({ name: 'type', enum: FavouriteType })
  @ApiParam({ name: 'id', description: 'The hotel id or the itinerary id' })
  remove(@CurrentUser() user: UserDocument, @Param() params: FavouriteParamsDto) {
    return this.favourites.remove(user, params);
  }
}
