import { Body, Controller, Get, HttpCode, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiResponse } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
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
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

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

  @Post('forgot-password')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute per IP
  @ApiOperation({
    summary: 'Ask for a password reset code by email',
    description:
      'ACC-07. Public. Always answers the same, whether or not the email exists. The code is valid for 30 minutes. Limited to 5 requests per minute per IP, and one email per minute per account.',
  })
  @ApiResponse({ status: 200, description: 'Generic answer: a code was sent if the account exists' })
  @ApiResponse({ status: 400, description: 'Invalid email format' })
  @ApiResponse({ status: 429, description: 'Too many requests from this IP' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto);
  }

  @Post('reset-password')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Set a new password with the code from the email',
    description:
      'ACC-07. Public. The code is single-use and valid for 30 minutes. After 5 wrong tries it must be requested again. All sessions are logged out.',
  })
  @ApiResponse({ status: 200, description: 'Password changed' })
  @ApiResponse({ status: 400, description: 'The code is wrong, expired or already used, or the new password is too weak' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
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