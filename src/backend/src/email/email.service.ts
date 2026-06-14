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
      this.logger.warn(
        'SMTP not configured — emails will be logged instead of sent',
      );
    }
  }

  async sendPasswordResetEmail(to: string, resetToken: string): Promise<void> {
    const baseUrl = this.configService.get<string>(
      'APP_BASE_URL',
      'http://localhost:4200',
    );
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

  async sendEmailVerificationEmail(
    to: string,
    verificationToken: string,
  ): Promise<void> {
    const baseUrl = this.configService.get<string>(
      'APP_BASE_URL',
      'http://localhost:4200',
    );
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

  async sendAccountUnlockEmail(to: string, unlockToken: string): Promise<void> {
    const baseUrl = this.configService.get<string>(
      'APP_BASE_URL',
      'http://localhost:4200',
    );
    const unlockLink = `${baseUrl}/auth/unlock?token=${encodeURIComponent(unlockToken)}`;
    const from = this.getFrom();

    const html = `
      <h2>Account Unlock</h2>
      <p>Your MixologyHub account has been locked due to too many failed login attempts.</p>
      <p><a href="${unlockLink}">Click here to unlock your account</a></p>
      <p>This link expires in 1 hour.</p>
      <p>If you didn't request this, you can safely ignore this email.</p>
    `;

    await this.sendMail({
      from,
      to,
      subject: 'MixologyHub — Unlock Your Account',
      html,
    });
  }

  async sendSessionEvictionEmail(
    to: string,
    revokedCount: number,
  ): Promise<void> {
    const from = this.getFrom();

    const html = `
      <h2>Session Eviction Notice</h2>
      <p>You have exceeded the maximum number of concurrent sessions (5).</p>
      <p>${revokedCount} older session(s) have been automatically revoked.</p>
      <p>If you did not initiate these sessions, please change your password immediately.</p>
    `;

    await this.sendMail({
      from,
      to,
      subject: 'MixologyHub — Session Limit Reached',
      html,
    });
  }

  async sendEmailChangeVerificationEmail(
    to: string,
    token: string,
  ): Promise<void> {
    const baseUrl = this.configService.get<string>(
      'APP_BASE_URL',
      'http://localhost:4200',
    );
    const verifyLink = `${baseUrl}/auth/confirm-email-change?token=${encodeURIComponent(token)}`;
    const from = this.getFrom();

    const html = `
      <h2>Verify Your New Email Address</h2>
      <p>You requested to change your MixologyHub account email to this address.</p>
      <p><a href="${verifyLink}">Click here to verify and activate your new email</a></p>
      <p>If you did not request this, you can safely ignore this email.</p>
    `;

    await this.sendMail({
      from,
      to,
      subject: 'MixologyHub — Verify New Email',
      html,
    });
  }

  async sendEmailChangeNoticeEmail(
    to: string,
    proposedEmail: string,
  ): Promise<void> {
    const from = this.getFrom();

    const html = `
      <h2>Security Alert: Email Change Requested</h2>
      <p>A request was made to change your MixologyHub account email to <strong>${proposedEmail}</strong>.</p>
      <p>We have sent a verification link to that new address to complete the process.</p>
      <p><strong>If you did not make this request</strong>, please change your password and contact support immediately to secure your account.</p>
    `;

    await this.sendMail({
      from,
      to,
      subject: 'MixologyHub — Security Alert: Email Change',
      html,
    });
  }

  async sendModerationNotification(
    to: string,
    subject: string,
    message: string,
  ): Promise<void> {
    const from = this.getFrom();

    const html = `
      <h2>Moderation Update</h2>
      <p>${message}</p>
      <p>For any questions or appeals regarding this decision, please contact the bar manager or reply to this message.</p>
      <br>
      <p>Thank you,</p>
      <p>The MixologyHub Moderation Team</p>
    `;

    await this.sendMail({
      from,
      to,
      subject,
      html,
    });
  }

  private async sendMail(options: {
    from: string;
    to: string;
    subject: string;
    html: string;
  }): Promise<void> {
    if (!this.transporter) {
      this.logger.log(
        `[EMAIL STUB] To: ${options.to} | Subject: ${options.subject}`,
      );
      return;
    }

    try {
      await this.transporter.sendMail(options);
      this.logger.log(`Email sent to ${options.to}: ${options.subject}`);
    } catch (error: any) {
      this.logger.error(
        `Failed to send email to ${options.to}: ${error.message}`,
      );
    }
  }

  private getFrom(): string {
    const name = this.configService.get<string>(
      'SMTP_FROM_NAME',
      'MixologyHub',
    );
    const address = this.configService.get<string>(
      'SMTP_FROM_ADDRESS',
      'noreply@mixologyhub.com',
    );
    return `"${name}" <${address}>`;
  }
}
