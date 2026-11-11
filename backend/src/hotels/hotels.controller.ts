import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { HotelsService } from './hotels.service';
import { CreateHotelDto, UpdateHotelDto } from './dto/hotel.dto';
import { Auth } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';
import type { UserDocument } from '../users/schemas/user.schema';

@ApiTags('Hotels')
@Controller('hotels')
export class HotelsController {
  constructor(private readonly hotels: HotelsService) {}

  @Auth(Role.ADMIN)
  @Post()
  @ApiOperation({ summary: 'Admin creates a hotel profile', description: 'HTL-01' })
  create(@Body() dto: CreateHotelDto) {
    return this.hotels.create(dto);
  }

  @Auth(Role.ADMIN, Role.HOTEL_MODERATOR)
  @Patch(':id')
  @ApiOperation({ summary: 'Edit hotel profile', description: 'HTL-01' })
  update(@CurrentUser() user: UserDocument, @Param('id') id: string, @Body() dto: UpdateHotelDto) {
    return this.hotels.update(user, id, dto);
  }

  // Keep :id routes LAST. Member 5 registers /hotels/search in a separate controller listed BEFORE this one.
  @Get(':id')
  @ApiOperation({ summary: 'Hotel details: profile, photos, amenities, times, policy, rating', description: 'HTL-02' })
  findOne(@Param('id') id: string) {
    return this.hotels.findOne(id);
  }
}
