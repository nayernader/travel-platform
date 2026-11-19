import { Body, Controller, Get, Param, Post, StreamableFile, Query } from '@nestjs/common';
import { ApiOperation, ApiProduces, ApiResponse, ApiTags } from '@nestjs/swagger';

import { FlightBookingsService } from './flight-bookings.service';
import { BookingRequestDto } from './dto/booking.dto';
import { ListBookingsQueryDto} from './dto/list-bookings-query.dto';

import { Auth } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';
import type { UserDocument } from '../users/schemas/user.schema';
import { RequireVerifiedEmail } from '../auth/decorators/require-verified-email.decorator';

@ApiTags('Flight Bookings')
@Controller('flight-bookings')
export class FlightBookingsController {
  constructor(private readonly bookings: FlightBookingsService) {}

  @Auth(Role.USER)
  @Post()
  @ApiOperation({
    summary: 'Check passengers and get the booking summary before payment (reserves no seats)',
    description:
      'FLT-19, FLT-21. Validates the flights, passenger types and extra baggage, and returns the price breakdown and total.',
  })
  @ApiResponse({ status: 201, description: 'Booking summary with seats, segments, baggage fee and total' })
  @ApiResponse({ status: 400, description: 'Invalid passengers, baggage or flight cannot be booked' })
  @ApiResponse({ status: 401, description: 'Not logged in' })
  @ApiResponse({ status: 403, description: 'Only registered users can book' })
  @ApiResponse({ status: 404, description: 'Flight not found' })
  @ApiResponse({ status: 409, description: 'Not enough seats in the selected cabin' })
  summary(@Body() dto: BookingRequestDto) {
    return this.bookings.summarize(dto);
  }

  @Auth(Role.USER)
  @RequireVerifiedEmail()
  @Post('hold')
  @ApiOperation({
    summary: 'Hold the seats for 10 minutes and create a Pending Payment booking',
    description:
      'FLT-22, GEN-11. Same body as the summary. Seats are taken in one atomic update; if payment does not succeed within 10 minutes the booking expires and the seats are released.',
  })
  @ApiResponse({ status: 201, description: 'Booking created in PENDING_PAYMENT with holdExpiresAt' })
  @ApiResponse({ status: 400, description: 'Invalid passengers, baggage or flight cannot be booked' })
  @ApiResponse({ status: 401, description: 'Not logged in' })
  @ApiResponse({ status: 403, description: 'Only registered users can book' })
  @ApiResponse({ status: 404, description: 'Flight not found' })
  @ApiResponse({ status: 409, description: 'Not enough seats left (someone else was faster)' })
  hold(@Body() dto: BookingRequestDto, @CurrentUser() user: UserDocument) {
    return this.bookings.hold(dto, user.id);
  }

  @Auth(Role.USER)
  @Get()
  @ApiOperation({
    summary: 'My flight bookings: upcoming, past or cancelled (10 per page)',
    description:
      'FLT-25, GEN-05. group=upcoming (confirmed, not departed), past (completed or departed), cancelled. Soonest first for upcoming, newest first otherwise.',
  })
  @ApiResponse({ status: 200, description: 'Page of my bookings with flights, passengers, cabin and status' })
  @ApiResponse({ status: 400, description: 'Invalid group or page' })
  @ApiResponse({ status: 401, description: 'Not logged in' })
  @ApiResponse({ status: 403, description: 'Only registered users have bookings' })
  findMine(@Query() query: ListBookingsQueryDto, @CurrentUser() user: UserDocument) {
    return this.bookings.findMine(user.id, query);
  }

  @Auth(Role.USER)
  @Get(':id/refund-preview')
  @ApiOperation({
    summary: 'See the refund before cancelling',
    description: 'FLT-26. Uses the airline cancellation tiers and the days left before the outbound flight. Changes nothing.',
  })
  @ApiResponse({ status: 200, description: 'daysRemaining, refundPercent and refundAmount' })
  @ApiResponse({ status: 401, description: 'Not logged in' })
  @ApiResponse({ status: 403, description: 'Only registered users' })
  @ApiResponse({ status: 404, description: 'Booking not found (or not yours)' })
  @ApiResponse({ status: 409, description: 'Booking is not confirmed or the flight has departed' })
  refundPreview(@Param('id') id: string, @CurrentUser() user: UserDocument) {
    return this.bookings.refundPreview(id, user.id);
  }

  @Auth(Role.USER)
  @Post(':id/cancel')
  @ApiOperation({
    summary: 'Cancel my confirmed booking before departure',
    description:
      'FLT-26, PAY-03. Refund follows the airline tiers. Seats are returned and a refund request is sent to payments.',
  })
  @ApiResponse({ status: 201, description: 'Booking CANCELLED with refundPercent and refundAmount' })
  @ApiResponse({ status: 401, description: 'Not logged in' })
  @ApiResponse({ status: 403, description: 'Only registered users' })
  @ApiResponse({ status: 404, description: 'Booking not found (or not yours)' })
  @ApiResponse({ status: 409, description: 'Booking is not confirmed or the flight has departed' })
  cancel(@Param('id') id: string, @CurrentUser() user: UserDocument) {
    return this.bookings.cancel(id, user.id);
  }
  @Get(':id')
  @ApiOperation({
    summary: 'One of my flight bookings with its flights (confirmation page)',
    description: 'FLT-23, FLT-25',
  })
  @ApiResponse({ status: 200, description: 'The booking with reference, status, flights, passengers and total' })
  @ApiResponse({ status: 401, description: 'Not logged in' })
  @ApiResponse({ status: 404, description: 'Booking not found (or not yours)' })
  findOne(@Param('id') id: string, @CurrentUser() user: UserDocument) {
    return this.bookings.findOne(id, user);
  }

  @Auth(Role.USER)
  @Get(':id/e-ticket')
  @ApiProduces('application/pdf')
  @ApiOperation({ summary: 'Download the e-ticket (PDF) of a confirmed booking', description: 'FLT-23' })
  @ApiResponse({ status: 200, description: 'PDF file' })
  @ApiResponse({ status: 401, description: 'Not logged in' })
  @ApiResponse({ status: 404, description: 'Booking not found (or not yours)' })
  @ApiResponse({ status: 409, description: 'The booking is not confirmed' })
  async eTicket(@Param('id') id: string, @CurrentUser() user: UserDocument) {
    const { fileName, pdf } = await this.bookings.eTicket(id, user);
    return new StreamableFile(pdf, {
      type: 'application/pdf',
      disposition: `attachment; filename="${fileName}"`,
    });
  }
}