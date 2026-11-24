import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from '../auth/decorators/auth.decorator';
import { Role } from '../common/enums/role.enum';
import { AdminAnalyticsService } from './admin-analytics.service';
import { AnalyticsQueryDto } from './dto/analytics.dto';

/** BON-01: read-only analytics for admins. */
@ApiTags('Admin')
@Auth(Role.ADMIN)
@Controller('admin/analytics')
export class AdminAnalyticsController {
  constructor(private readonly analytics: AdminAnalyticsService) {}

  @Get('bookings')
  @ApiOperation({
    summary: 'Bookings and revenue per provider over a period (BON-01)',
    description:
      'BON-01. One row per airline and hotel: bookings made in the period, paid (Confirmed or Completed), cancelled, and revenue from paid bookings in the platform currency. Default period: the last 30 days. Paginated by 10.',
  })
  bookings(@Query() dto: AnalyticsQueryDto) {
    return this.analytics.bookings(dto);
  }
}
