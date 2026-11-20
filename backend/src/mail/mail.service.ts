
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    const port = Number(this.config.get<string>('SMTP_PORT') ?? 587);

    this.from = this.config.get<string>('SMTP_FROM') ?? user ?? '';

    this.transporter =
      host && user && pass
        ? nodemailer.createTransport({
            host,
            port,
            secure: port === 465,
            auth: { user, pass },
          })
        : null;

    if (!this.transporter) {
      this.logger.warn('SMTP is not configured: emails will not be sent');
    }
  }

  async sendVerificationEmail(
    to: string,
    name: string,
    token: string,
  ): Promise<boolean> {
    if (!this.transporter) return false;

    const base = this.config.get<string>('FRONTEND_URL');

    if (!base) {
      this.logger.error('FRONTEND_URL is not configured');
      return false;
    }

    const link =
      `${base.replace(/\/$/, '')}/api/auth/verify-email-page` +
      `?email=${encodeURIComponent(to)}` +
      `&token=${encodeURIComponent(token)}`;

    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject: 'Verify your email address',
        text:
          `Hello ${name},\n\n` +
          `Verify your email by opening this link:\n${link}\n\n` +
          `This link is valid for 15 minutes and can only be used once.\n` +
          `If you did not create an account, ignore this email.\n`,
        html:
          `<p>Hello ${escapeHtml(name)},</p>` +
          `<p><a href="${escapeHtml(link)}">Verify my email</a></p>` +
          `<p>This link is valid for 15 minutes and can only be used once.</p>` +
          `<p>If you did not create an account, ignore this email.</p>`,
      });

      return true;
    } catch (err) {
      this.logger.error('Could not send the verification email', err as Error);
      return false;
    }
  }



  async sendPasswordResetLink(
    to: string,
    name: string,
    token: string,
  ): Promise<boolean> {
    if (!this.transporter) return false;

    const base = this.config.get<string>('FRONTEND_URL');

    if (!base) {
      this.logger.error('FRONTEND_URL is not configured');
      return false;
    }

    const link =
      `${base.replace(/\/$/, '')}/api/auth/reset-password-page` +
      `?email=${encodeURIComponent(to)}` +
      `&token=${encodeURIComponent(token)}`;

    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject: 'Reset your password',
        text:
          `Hello ${name},\n\n` +
          `Reset your password by opening this link:\n${link}\n\n` +
          `This link expires after 30 minutes and can only be used once.\n` +
          `If you did not request a password reset, ignore this email. Your password has not changed.\n`,
        html:
          `<p>Hello ${escapeHtml(name)},</p>` +
          `<p><a href="${escapeHtml(link)}">Reset my password</a></p>` +
          `<p>This link expires after 30 minutes and can only be used once.</p>` +
          `<p>If you did not request a password reset, ignore this email. Your password has not changed.</p>`,
      });

      return true;
    } catch (err) {
      this.logger.error('Could not send the password reset email', err as Error);
      return false;
    }
  }


  async sendNotificationEmail(to: string, name: string, subject: string, message: string): Promise<boolean> {
    if (!this.transporter) return false;

    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject,
        text: `Hello ${name},\n\n${message}\n`,
        html: `<p>Hello ${escapeHtml(name)},</p><p>${escapeHtml(message)}</p>`,
      });

      return true;
    } catch (err) {
      this.logger.error('Could not send the notification email', err as Error);
      return false;
    }
  }

  async sendModeratorInvitation(
    to: string,
    name: string,
    roleLabel: string,
    providerName: string,
  ): Promise<boolean> {
    if (!this.transporter) return false;

    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject: 'Your moderator account was created',
        text:
          `Hello ${name},\n\n` +
          `An administrator created a ${roleLabel} account for you for "${providerName}".\n` +
          `Your administrator will give you your temporary password separately. You must change it the first time you log in.\n`,
        html:
          `<p>Hello ${escapeHtml(name)},</p>` +
          `<p>An administrator created a ${escapeHtml(roleLabel)} account for you for <b>${escapeHtml(providerName)}</b>.</p>` +
          `<p>Your administrator will give you your temporary password separately. You must change it the first time you log in.</p>`,
      });

      return true;
    } catch (err) {
      this.logger.error('Could not send the moderator invitation', err as Error);
      return false;
    }
  }
}
