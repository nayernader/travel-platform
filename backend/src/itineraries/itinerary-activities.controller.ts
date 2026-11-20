import { Body, Controller, Delete, Param, Patch, Post, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ItineraryActivitiesService } from './itinerary-activities.service';
import { CreateActivityDto, UpdateActivityDto } from './dto/activity.dto';
import { Auth } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { UserDocument } from '../users/schemas/user.schema';
import { Role } from '../common/enums/role.enum';
import { imageUploadOptions } from '../uploads/image-upload.options';

@ApiTags('Itinerary activities')
@Controller('itineraries/:id/days/:dayId/activities')
export class DayActivitiesController {
  constructor(private readonly acts: ItineraryActivitiesService) {}

  @Auth(Role.USER)
  @Post()
  @ApiOperation({ summary: 'Add an activity to a day: name, description, optional time and cost (ITN-10)' })
  @ApiResponse({ status: 201, description: 'Itinerary with the new activity' })
  @ApiResponse({ status: 400, description: 'Invalid name, time, cost or currency' })
  @ApiResponse({ status: 404, description: 'Itinerary or day not found, or not yours' })
  add(
    @CurrentUser() user: UserDocument,
    @Param('id') id: string,
    @Param('dayId') dayId: string,
    @Body() dto: CreateActivityDto,
  ) {
    return this.acts.add(user, id, dayId, dto);
  }
}

@ApiTags('Itinerary activities')
@Controller('activities')
export class ActivitiesController {
  constructor(private readonly acts: ItineraryActivitiesService) {}

  @Auth(Role.USER)
  @Patch(':id')
  @ApiOperation({ summary: 'Edit an activity (ITN-10)' })
  @ApiResponse({ status: 200, description: 'Updated itinerary' })
  @ApiResponse({ status: 404, description: 'Activity not found, or not yours' })
  update(@CurrentUser() user: UserDocument, @Param('id') id: string, @Body() dto: UpdateActivityDto) {
    return this.acts.update(user, id, dto);
  }

  @Auth(Role.USER)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete an activity (ITN-10)' })
  @ApiResponse({ status: 200, description: 'Updated itinerary' })
  @ApiResponse({ status: 404, description: 'Activity not found, or not yours' })
  remove(@CurrentUser() user: UserDocument, @Param('id') id: string) {
    return this.acts.remove(user, id);
  }

  @Auth(Role.USER)
  @Post(':id/images')
  @UseInterceptors(FilesInterceptor('files', 5, imageUploadOptions))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { files: { type: 'array', items: { type: 'string', format: 'binary' } } } },
  })
  @ApiOperation({ summary: 'Attach up to 5 JPG/PNG images, 5 MB each, per activity (ITN-12, GEN-08)' })
  @ApiResponse({ status: 201, description: 'Updated itinerary with the image URLs' })
  @ApiResponse({ status: 400, description: 'Not a real JPG/PNG, no file, or more than 5 images' })
  addImages(
    @CurrentUser() user: UserDocument,
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.acts.addImages(user, id, files ?? []);
  }

  @Auth(Role.USER)
  @Delete(':id/images/:imageId')
  @ApiOperation({ summary: 'Remove one image from an activity (ITN-12)' })
  @ApiResponse({ status: 200, description: 'Updated itinerary' })
  @ApiResponse({ status: 404, description: 'Activity or image not found' })
  removeImage(@CurrentUser() user: UserDocument, @Param('id') id: string, @Param('imageId') imageId: string) {
    return this.acts.removeImage(user, id, imageId);
  }
}