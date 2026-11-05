import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt'; // NEW
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './schemas/user.schema';
import { UsersController } from './users.controller'; // NEW
import { UsersService } from './users.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    JwtModule.register({}), // NEW: @Auth() guards verify tokens, so controllers here need JwtService (secrets are passed per call, as in AuthService)
  ],
  controllers: [UsersController], // NEW
  providers: [UsersService],
  exports: [UsersService, MongooseModule], // the Auth and Admin modules will use these
})
export class UsersModule {}