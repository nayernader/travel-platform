import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto, UpdateReviewDto ,ReplyReviewDto} from './dto/review.dto';
import { Auth } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { UserDocument } from '../users/schemas/user.schema';
import { Role } from '../common/enums/role.enum';

@ApiTags('Hotel reviews')
@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Auth()
  @Post('hotel-bookings/:id/review')
  @ApiOperation({ summary: 'Rate a Completed reservation, once (HTL-23)' })
  create(
    @CurrentUser() user: UserDocument,
    @Param('id') id: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviews.create(user, id, dto);
  }

  @Auth()
  @Patch('reviews/:id')
  @ApiOperation({ summary: 'Edit my review (HTL-23)' })
  update(
    @CurrentUser() user: UserDocument,
    @Param('id') id: string,
    @Body() dto: UpdateReviewDto,
  ) {
    return this.reviews.update(user, id, dto);
  }

  @Auth()
  @Delete('reviews/:id')
  @ApiOperation({ summary: 'Delete my review (HTL-23)' })
  remove(@CurrentUser() user: UserDocument, @Param('id') id: string) {
    return this.reviews.remove(user, id);
  }

  @Auth(Role.HOTEL_MODERATOR)
  @Post('reviews/:id/reply')
  @ApiOperation({ summary: 'Hotel moderator replies to a review of their hotel (HTL-26, optional)' })
  reply(
    @CurrentUser() user: UserDocument,
    @Param('id') id: string,
    @Body() dto: ReplyReviewDto,
  ) {
    return this.reviews.reply(user, id, dto);
  }

  @Get('hotels/:id/reviews')
  @ApiOperation({
    summary: 'Average rating, count and reviews newest first (HTL-24)',
  })
  list(@Param('id') id: string, @Query('page') page = '1') {
    return this.reviews.listForHotel(id, Number(page) || 1);
  }
}
