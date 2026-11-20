import { Body, Controller, Get, HttpCode, Patch, Res } from '@nestjs/common'; // NEW: HttpCode, Res
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express'; // NEW
import { Auth } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ACCESS_COOKIE, REFRESH_COOKIE } from '../common/constants/auth.constants'; // NEW
import { DeactivateAccountDto } from './dto/deactivate-account.dto'; // NEW
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

  // NEW: ACC-12
  @Patch('me/deactivate')
  @HttpCode(200)
  @Auth()
  @ApiOperation({
    summary: 'Deactivate my account',
    description: 'ACC-12. Needs the current password. 409 HAS_FUTURE_BOOKINGS if the user has upcoming confirmed bookings. Admins cannot use this.',
  })
  async deactivateMe(
    @CurrentUser() user: UserDocument,
    @Body() dto: DeactivateAccountDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.users.deactivateSelf(user.id, dto.password);
    // Same paths the cookies were set with in AuthService
    res.clearCookie(ACCESS_COOKIE, { path: '/' });
    res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
    return result;
  }
}