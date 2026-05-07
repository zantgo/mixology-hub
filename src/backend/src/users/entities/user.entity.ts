import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
@Entity('users')
export class User {
  @Expose()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Expose()
  @Column({ unique: true })
  email: string;

  @Expose()
  @Column({ name: 'display_name' })
  displayName: string;

  @Column({ name: 'password_hash' })
  passwordHash: string;

  @Expose()
  @Column({ name: 'email_verified', default: false })
  emailVerified: boolean;

  @Column({ name: 'email_verification_token', nullable: true })
  emailVerificationToken: string | null;

  @Column({ name: 'reset_password_token', nullable: true })
  resetPasswordToken: string | null;

  @Column({ name: 'reset_password_expires', nullable: true, type: 'timestamp' })
  resetPasswordExpires: Date | null;

  @Column({ name: 'refresh_token', nullable: true, type: 'text' })
  refreshToken: string | null;

  @Column({ name: 'failed_login_attempts', default: 0 })
  failedLoginAttempts: number;

  @Column({ name: 'account_locked_until', nullable: true, type: 'timestamp' })
  accountLockedUntil: Date | null;

  @Column({ name: 'account_unlock_token', nullable: true })
  accountUnlockToken: string | null;

  @Column({
    name: 'account_unlock_expires',
    nullable: true,
    type: 'timestamp',
  })
  accountUnlockExpires: Date | null;

  @Expose()
  @Column({ name: 'last_login_at', nullable: true, type: 'timestamp' })
  lastLoginAt: Date | null;

  @Expose()
  @Column({ name: 'gdpr_deletion_requested', default: false })
  gdprDeletionRequested: boolean;

  @Expose()
  @Column({
    name: 'gdpr_deletion_scheduled_at',
    nullable: true,
    type: 'timestamp',
  })
  gdprDeletionScheduledAt: Date | null;

  @Expose()
  @Column({ name: 'is_anonymized', default: false })
  is_anonymized: boolean;

  @Expose()
  @Column({ name: 'anonymized_at', nullable: true, type: 'timestamp' })
  anonymized_at: Date | null;

  @Expose()
  @Column({ name: 'username', nullable: true })
  username: string | null;

  @Expose()
  @Column({ name: 'first_name', nullable: true })
  first_name: string | null;

  @Expose()
  @Column({ name: 'last_name', nullable: true })
  last_name: string | null;

  @Expose()
  @Column({ name: 'role', default: 'bartender' })
  role: string;

  @Expose()
  @Column({ name: 'profile_picture_url', nullable: true, type: 'text' })
  profile_picture_url: string | null;

  @Expose()
  @Column({ name: 'bio', nullable: true, type: 'text' })
  bio: string | null;

  @Expose()
  @Column({ name: 'date_of_birth', nullable: true, type: 'date' })
  date_of_birth: Date | null;

  @Expose()
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Expose()
  @Column({
    name: 'updated_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;

  @Expose()
  @Index()
  @Column({ name: 'is_active', default: true })
  isActive: boolean;
}
