import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from '../users/users.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminBookingsController } from './admin-bookings.controller';
import { AdminBookingsService } from './admin-bookings.service';
import { AdminAccountsController } from './admin-accounts.controller';
import { AdminAccountsService } from './admin-accounts.service';
import { AdminProvidersController } from './admin-providers.controller';
import { AdminProvidersService } from './admin-providers.service';
import { ModerationService } from './moderation.service';
import { ReportsController } from './reports.controller';
import { Report, ReportSchema } from './schemas/report.schema';

// AuditModule and NotificationsModule are @Global(), so their services are available without importing them here
@Module({
  imports: [
    UsersModule, // UsersService (also used by the @Auth() guard)
    JwtModule.register({}), // JwtService for the @Auth() guard
    MongooseModule.forFeature([{ name: Report.name, schema: ReportSchema }]),
  ],
  controllers: [
    AdminController,
    AdminAccountsController,
    ReportsController,
    AdminProvidersController,
    AdminBookingsController,
  ],
  providers: [
    AdminService,
    AdminAccountsService,
    ModerationService,
    AdminProvidersService,
    AdminBookingsService,
  ],
})
export class AdminModule {}
