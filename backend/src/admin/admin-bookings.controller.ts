import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from '../auth/decorators/auth.decorator';
import { Role } from '../common/enums/role.enum';
import { AdminBookingsService } from './admin-bookings.service';
import { ListBookingsDto } from './dto/bookings.dto';

/** Read-only on purpose: there is no create, edit or delete route here (ACC-17). */
@ApiTags('Admin')
@Auth(Role.ADMIN)
@Controller('admin/bookings')
export class AdminBookingsController {
  constructor(private readonly bookings: AdminBookingsService) {}

  @Get()
  @ApiOperation({ summary: 'All flight and hotel bookings, read-only, filter by type, status and travel dates (ACC-17)' })
  list(@Query() dto: ListBookingsDto) {
    return this.bookings.list(dto);
  }
}
