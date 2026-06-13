import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { User } from '../users/entities/user.entity';

@Injectable()
export class AuthCleanupService {
  private readonly logger = new Logger(AuthCleanupService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async cleanupExpiredResetTokens(): Promise<void> {
    const result = await this.userRepository
      .createQueryBuilder()
      .update(User)
      .set({
        resetPasswordToken: null,
        resetPasswordExpires: null,
      })
      .where('resetPasswordExpires < :now', { now: new Date() })
      .andWhere('resetPasswordToken IS NOT NULL')
      .execute();

    if (result.affected) {
      this.logger.log(
        `Cleared ${result.affected} expired password reset tokens`,
      );
    }
  }

  @Cron(CronExpression.EVERY_WEEK)
  async cleanupStaleVerificationTokens(): Promise<void> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const result = await this.userRepository
      .createQueryBuilder()
      .update(User)
      .set({ emailVerificationToken: null })
      .where('emailVerified = :verified', { verified: false })
      .andWhere('emailVerificationToken IS NOT NULL')
      .andWhere('createdAt < :cutoff', { cutoff: sevenDaysAgo })
      .execute();

    if (result.affected) {
      this.logger.log(
        `Cleared ${result.affected} stale email verification tokens`,
      );
    }
  }
}
