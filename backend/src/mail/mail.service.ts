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
        ? nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } })
        : null;
    if (!this.transporter) this.logger.warn('SMTP is not configured: emails will not be sent');
  }

  /** ACC-02: returns true if the email was sent. Never throws, so registration still works. */
  async sendVerificationCode(to: string, name: string, code: string): Promise<boolean> {
    if (!this.transporter) return false;
    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject: 'Your verification code',
        text: `Hello ${name},\n\nYour verification code is: ${code}\n\nIt is valid for 15 minutes. If you did not create an account, ignore this email.\n`,
        html:
          `<p>Hello ${escapeHtml(name)},</p>` +
          `<p>Your verification code is:</p>` +
          `<p style="font-size:28px;letter-spacing:6px"><b>${code}</b></p>` +
          `<p>It is valid for 15 minutes. If you did not create an account, ignore this email.</p>`,
      });
      return true;
    } catch (err) {
      this.logger.error('Could not send the verification email', err as Error);
      return false;
    }
  }

  /** ACC-07: returns true if the email was sent. Never throws. */
  async sendPasswordResetCode(to: string, name: string, code: string): Promise<boolean> {
    if (!this.transporter) return false;
    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject: 'Your password reset code',
        text: `Hello ${name},\n\nYour password reset code is: ${code}\n\nIt is valid for 15 minutes and can be used once. If you did not ask for it, ignore this email: your password has not changed.\n`,
        html:
          `<p>Hello ${escapeHtml(name)},</p>` +
          `<p>Your password reset code is:</p>` +
          `<p style="font-size:28px;letter-spacing:6px"><b>${code}</b></p>` +
          `<p>It is valid for 15 minutes and can be used once. If you did not ask for it, ignore this email: your password has not changed.</p>`,
      });
      return true;
    } catch (err) {
      this.logger.error('Could not send the password reset email', err as Error);
      return false;
    }
  }
}