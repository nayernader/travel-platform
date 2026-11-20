import { Body, Controller, Get, HttpCode, Patch, Post, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiResponse } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type { UserDocument } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { AllowTemporaryPassword } from './decorators/allow-temporary-password.decorator';
import { Auth } from './decorators/auth.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
  ) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new traveler account', description: 'ACC-01' })
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }
  
  @Post('verify-email')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Verify my email with the 6-digit code',
    description: 'ACC-02. Public. The code is valid for 15 minutes. After 5 wrong tries it must be requested again.',
  })
  @ApiResponse({ status: 200, description: 'Email verified' })
  @ApiResponse({ status: 400, description: 'The code is wrong, expired or already used' })
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.auth.verifyEmail(dto);
  }

  @Post('resend-verification')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Send a new 6-digit code',
    description: 'ACC-02. Public. The old code stops working. One request per minute.',
  })
  @ApiResponse({ status: 200, description: 'A new code was sent if the account exists and is not verified' })
  @ApiResponse({ status: 429, description: 'Too soon after the last email' })
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.auth.resendVerification(dto);
  }

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Log in (sets httpOnly cookies)', description: 'ACC-04, ACC-05, ACC-19' })
  login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    return this.auth.login(dto, res);
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Get a new access token from the refresh cookie', description: 'ACC-06' })
  refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.auth.refresh(req, res);
  }

  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Log out and revoke the refresh token', description: 'ACC-06' })
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.auth.logout(req, res);
  }

  @Get('me')
  @Auth()
  @AllowTemporaryPassword() // NEW (ACC-13): the frontend needs this to see mustChangePassword
  @ApiOperation({ summary: 'Current logged-in user', description: 'ACC-04, ACC-11, ACC-19' })
  me(@CurrentUser() user: UserDocument) {
    return this.users.toResponse(user);
  }

  // ACC-08 change my password (also finishes a temporary-password login, ACC-07a / ACC-13)
  @Patch('change-password')
  @Auth()
  @AllowTemporaryPassword() // NEW (ACC-13): the one route that clears a temporary password
  @ApiOperation({ summary: 'Change my password with the current one', description: 'ACC-08, ACC-07a, ACC-13' })
  changePassword(
    @CurrentUser() user: UserDocument,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.changePassword(user, dto, res);
  }
}