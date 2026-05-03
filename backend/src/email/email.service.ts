import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('SMTP_HOST');
    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port: this.configService.get<number>('SMTP_PORT', 587),
        secure: this.configService.get<boolean>('SMTP_SECURE', false),
        auth: {
          user: this.configService.get<string>('SMTP_USER'),
          pass: this.configService.get<string>('SMTP_PASS'),
        },
      });
    } else {
      this.logger.warn('SMTP not configured — emails will be logged instead of sent');
    }
  }

  async sendPasswordResetEmail(to: string, resetToken: string): Promise<void> {
    const baseUrl = this.configService.get<string>('APP_BASE_URL', 'http://localhost:4200');
    const resetLink = `${baseUrl}/auth/reset-password?token=${encodeURIComponent(resetToken)}`;
    const from = this.getFrom();

    const html = `
      <h2>Password Reset</h2>
      <p>You requested a password reset for your MixologyHub account.</p>
      <p><a href="${resetLink}">Click here to reset your password</a></p>
      <p>This link expires in 1 hour.</p>
      <p>If you didn't request this, you can safely ignore this email.</p>
    `;

    await this.sendMail({
      from,
      to,
      subject: 'MixologyHub — Password Reset',
      html,
    });
  }

  async sendEmailVerificationEmail(to: string, verificationToken: string): Promise<void> {
    const baseUrl = this.configService.get<string>('APP_BASE_URL', 'http://localhost:4200');
    const verifyLink = `${baseUrl}/auth/verify-email?token=${encodeURIComponent(verificationToken)}`;
    const from = this.getFrom();

    const html = `
      <h2>Verify Your Email</h2>
      <p>Welcome to MixologyHub! Please verify your email address.</p>
      <p><a href="${verifyLink}">Click here to verify your email</a></p>
      <p>If you didn't create an account, you can safely ignore this email.</p>
    `;

    await this.sendMail({
      from,
      to,
      subject: 'MixologyHub — Verify Your Email',
      html,
    });
  }

  private async sendMail(options: { from: string; to: string; subject: string; html: string }): Promise<void> {
    if (!this.transporter) {
      this.logger.log(`[EMAIL STUB] To: ${options.to} | Subject: ${options.subject}`);
      return;
    }

    try {
      await this.transporter.sendMail(options);
      this.logger.log(`Email sent to ${options.to}: ${options.subject}`);
    } catch (error: any) {
      this.logger.error(`Failed to send email to ${options.to}: ${error.message}`);
    }
  }

  private getFrom(): string {
    const name = this.configService.get<string>('SMTP_FROM_NAME', 'MixologyHub');
    const address = this.configService.get<string>('SMTP_FROM_ADDRESS', 'noreply@mixologyhub.com');
    return `"${name}" <${address}>`;
  }
}
