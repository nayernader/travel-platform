import { Body, Controller, Delete, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ItineraryBookingsService } from './itinerary-bookings.service';
import { AttachBookingDto } from './dto/attach-booking.dto';
import { Auth } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { UserDocument } from '../users/schemas/user.schema';
import { Role } from '../common/enums/role.enum';

@ApiTags('Itineraries')
@Controller('itineraries')
export class ItineraryBookingsController {
  constructor(private readonly bookings: ItineraryBookingsService) {}

  @Auth(Role.USER)
  @Post(':id/bookings')
  @ApiOperation({
    summary: 'Attach one of my confirmed flight or hotel bookings to my itinerary (ITN-27, optional)',
    description: 'Only your own CONFIRMED bookings. The same booking cannot be attached twice to one itinerary.',
  })
  @ApiResponse({ status: 201, description: 'The itinerary with its attachedBookings' })
  @ApiResponse({ status: 400, description: 'Invalid type or bookingId, or the booking is not confirmed' })
  @ApiResponse({ status: 404, description: 'Itinerary or booking not found, or not yours' })
  @ApiResponse({ status: 409, description: 'Booking already attached to this itinerary' })
  attach(@CurrentUser() user: UserDocument, @Param('id') id: string, @Body() dto: AttachBookingDto) {
    return this.bookings.attach(user, id, dto);
  }

  @Auth(Role.USER)
  @Delete(':id/bookings/:bookingId')
  @ApiOperation({ summary: 'Detach a booking from my itinerary (undo ITN-27)' })
  @ApiResponse({ status: 200, description: 'The itinerary without that booking' })
  @ApiResponse({ status: 404, description: 'Itinerary not found or not yours, or the booking is not attached' })
  detach(@CurrentUser() user: UserDocument, @Param('id') id: string, @Param('bookingId') bookingId: string) {
    return this.bookings.detach(user, id, bookingId);
  }
}