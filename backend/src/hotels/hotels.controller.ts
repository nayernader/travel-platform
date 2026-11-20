import { Body, Controller, Get, Param, Patch, Post, Put, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HotelsService } from './hotels.service';
import { CreateHotelDto, UpdateHotelDto } from './dto/hotel.dto';
import { PoliciesDto } from './dto/policies.dto';
import { Auth } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';
import { imageUploadOptions } from '../uploads/image-upload.options';
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

  @Auth(Role.HOTEL_MODERATOR)
  @Put(':id/policies')
  @ApiOperation({ summary: 'Set check-in/out times and cancellation tiers', description: 'HTL-09, HTL-10' })
  setPolicies(@CurrentUser() user: UserDocument, @Param('id') id: string, @Body() dto: PoliciesDto) {
    return this.hotels.setPolicies(user, id, dto);
  }

  @Auth(Role.ADMIN, Role.HOTEL_MODERATOR)
  @Post(':id/photos')
  @UseInterceptors(FilesInterceptor('files', 5, imageUploadOptions))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { files: { type: 'array', items: { type: 'string', format: 'binary' } } } },
  })
  @ApiOperation({ summary: 'Upload hotel photos (JPG/PNG, max 5 MB each, max 5 per hotel)', description: 'HTL-01, GEN-08' })
  addPhotos(@CurrentUser() user: UserDocument, @Param('id') id: string, @UploadedFiles() files: Express.Multer.File[]) {
    return this.hotels.addPhotos(user, id, files);
  }

  // Keep :id routes LAST. Member 5 registers /hotels/search in a separate controller listed BEFORE this one.
  @Get(':id')
  @ApiOperation({ summary: 'Hotel details: profile, photos, amenities, times, policy, rating', description: 'HTL-02' })
  findOne(@Param('id') id: string) {
    return this.hotels.findOne(id);
  }
}
