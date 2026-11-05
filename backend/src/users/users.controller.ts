import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';
import type { UserDocument } from './schemas/user.schema';
import { UsersService } from './users.service';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @Auth()
  @ApiOperation({ summary: 'View my profile', description: 'ACC-11' })
  me(@CurrentUser() user: UserDocument) {
    return this.users.toResponse(user);
  }

  @Patch('me')
  @Auth()
  @ApiOperation({ summary: 'Edit my name, phone and preferred currency', description: 'ACC-09' })
  updateMe(@CurrentUser() user: UserDocument, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(user.id, dto);
  }
}