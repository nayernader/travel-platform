
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type { UserDocument } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { AllowTemporaryPassword } from './decorators/allow-temporary-password.decorator';
import { Auth } from './decorators/auth.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
  ) {}

  @Post('register')
  @ApiOperation({
    summary: 'Register a new traveler account',
    description: 'ACC-01. Sends an email verification link.',
  })
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('verify-email')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Verify email using the token from the email link',
    description: 'ACC-02. Public. The token is valid for 15 minutes and can only be used once.',
  })
  @ApiResponse({ status: 200, description: 'Email verified' })
  @ApiResponse({ status: 400, description: 'The link is invalid or expired' })
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.auth.verifyEmail(dto);
  }

  @Post('resend-verification')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Resend the email verification link',
    description: 'ACC-02. Public. The previous link becomes invalid. One request per minute.',
  })
  @ApiResponse({ status: 200, description: 'Generic response' })
  @ApiResponse({ status: 429, description: 'Too soon after the last email' })
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.auth.resendVerification(dto);
  }

  @Post('forgot-password')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Request a password reset link',
    description: 'ACC-07. Public. Always returns the same response. The link expires after 30 minutes and is single-use.',
  })
  @ApiResponse({ status: 200, description: 'Generic response' })
  @ApiResponse({ status: 429, description: 'Too many requests from this IP' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto);
  }

  @Post('reset-password')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Reset password using the email link token',
    description: 'ACC-07. Public. The token expires after 30 minutes and can only be used once.',
  })
  @ApiResponse({ status: 200, description: 'Password changed' })
  @ApiResponse({ status: 400, description: 'The link is invalid or expired' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }

  @Post('login')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Log in (sets httpOnly cookies)',
    description: 'ACC-04, ACC-05, ACC-19',
  })
  login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.login(dto, res);
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get a new access token from the refresh cookie',
    description: 'ACC-06',
  })
  refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.refresh(req, res);
  }

  @Post('logout')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Log out and revoke the refresh token',
    description: 'ACC-06',
  })
  logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.logout(req, res);
  }

  @Get('me')
  @Auth()
  @AllowTemporaryPassword()
  @ApiOperation({
    summary: 'Current logged-in user',
    description: 'ACC-04, ACC-11, ACC-19',
  })
  me(@CurrentUser() user: UserDocument) {
    return this.users.toResponse(user);
  }

  @Patch('change-password')
  @Auth()
  @AllowTemporaryPassword()
  @ApiOperation({
    summary: 'Change my password with the current one',
    description: 'ACC-08, ACC-07a, ACC-13',
  })
  changePassword(
    @CurrentUser() user: UserDocument,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.changePassword(user, dto, res);
  }

  @Get('reset-password-page')
  resetPasswordPage(@Res() res: Response) {
    return res.type('html').send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Password</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            background: #f5f5f5;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
          }
          .container {
            background: white;
            padding: 35px;
            border-radius: 12px;
            width: 90%;
            max-width: 400px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.08);
          }
          input, button {
            box-sizing: border-box;
            width: 100%;
            padding: 12px;
            margin-top: 12px;
            border-radius: 6px;
            font-size: 15px;
          }
          input { border: 1px solid #ddd; }
          button {
            background: #2563eb;
            color: white;
            border: none;
            cursor: pointer;
          }
          button:disabled { opacity: 0.6; cursor: not-allowed; }
          #message { margin-top: 20px; overflow-wrap: anywhere; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Reset Your Password</h2>
          <p>Enter your new password below.</p>
          <form id="resetForm">
            <input
              type="password"
              id="password"
              placeholder="New password"
              required
              minlength="8"
              autocomplete="new-password"
            />
            <input
              type="password"
              id="confirmPassword"
              placeholder="Confirm new password"
              required
              minlength="8"
              autocomplete="new-password"
            />
            <button type="submit" id="submitButton">Reset Password</button>
          </form>
          <p id="message"></p>
        </div>

        <script>
          const form = document.getElementById('resetForm');
          const button = document.getElementById('submitButton');
          const message = document.getElementById('message');
          const params = new URLSearchParams(window.location.search);

          const email = params.get('email');
          const token = params.get('token');

          if (!email || !token) {
            button.disabled = true;
            message.textContent = 'Invalid reset link. Missing email or token.';
          }

          form.addEventListener('submit', async (event) => {
            event.preventDefault();

            const newPassword = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;

            if (newPassword !== confirmPassword) {
              message.textContent = 'Passwords do not match.';
              return;
            }

            button.disabled = true;
            message.textContent = 'Resetting your password...';

            try {
              const response = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, token, newPassword })
              });

              const data = await response.json();

              if (!response.ok) {
                throw new Error(
                  Array.isArray(data.message)
                    ? data.message.join(', ')
                    : data.message || 'Password reset failed'
                );
              }

              message.textContent = 'Password changed successfully. You can now log in.';
              form.reset();
              form.style.display = 'none';
            } catch (error) {
              message.textContent = error.message || 'Password reset failed';
              button.disabled = false;
            }
          });
        </script>
      </body>
      </html>
    `);
  }

  @Get('verify-email-page')
  verifyEmailPage(@Res() res: Response) {
    return res.type('html').send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Email</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            background: #f5f5f5;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
          }
          .container {
            background: white;
            padding: 35px;
            border-radius: 12px;
            text-align: center;
            width: 90%;
            max-width: 400px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.08);
          }
          button {
            background: #2563eb;
            color: white;
            border: none;
            padding: 12px 25px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 16px;
          }
          button:disabled { opacity: 0.6; cursor: not-allowed; }
          #message { margin-top: 20px; overflow-wrap: anywhere; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Verify Your Email</h2>
          <p>Click the button below to verify your email address.</p>
          <button id="verifyButton">Verify Email</button>
          <p id="message"></p>
        </div>

        <script>
          const button = document.getElementById('verifyButton');
          const message = document.getElementById('message');
          const params = new URLSearchParams(window.location.search);

          const email = params.get('email');
          const token = params.get('token');

          if (!email || !token) {
            button.disabled = true;
            message.textContent = 'Invalid verification link. Missing email or token.';
          }

          button.addEventListener('click', async () => {
            button.disabled = true;
            message.textContent = 'Verifying your email...';

            try {
              const response = await fetch('/api/auth/verify-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, token })
              });

              const data = await response.json();

              if (!response.ok) {
                throw new Error(
                  Array.isArray(data.message)
                    ? data.message.join(', ')
                    : data.message || 'Verification failed'
                );
              }

              message.textContent = 'Your email has been verified successfully!';
              button.textContent = 'Verified';
            } catch (error) {
              message.textContent = error.message || 'Verification failed';
              button.disabled = false;
            }
          });
        </script>
      </body>
      </html>
    `);
  }
}
