import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

// AuditModule and NotificationsModule are @Global(), so their services are available without importing them here
@Module({
  imports: [
    UsersModule, // UsersService (also used by the @Auth() guard)
    JwtModule.register({}), // JwtService for the @Auth() guard
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}