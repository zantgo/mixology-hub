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
  @Column({ unique: true, type: 'varchar' })
  email: string;

  @Expose()
  @Column({ name: 'display_name', type: 'varchar' })
  displayName: string;

  @Column({ name: 'password_hash', type: 'varchar' })
  passwordHash: string;

  @Expose()
  @Column({ name: 'email_verified', default: false })
  emailVerified: boolean;

  @Column({ name: 'email_verification_token', nullable: true, type: 'varchar' })
  emailVerificationToken: string | null;

  @Column({ name: 'reset_password_token', nullable: true, type: 'varchar' })
  resetPasswordToken: string | null;

  @Column({ name: 'reset_password_expires', nullable: true, type: 'timestamp' })
  resetPasswordExpires: Date | null;

  @Column({ name: 'refresh_token', nullable: true, type: 'text' })
  refreshToken: string | null;

  @Column({ name: 'failed_login_attempts', default: 0 })
  failedLoginAttempts: number;

  @Column({ name: 'account_locked_until', nullable: true, type: 'timestamp' })
  accountLockedUntil: Date | null;

  @Column({ name: 'account_unlock_token', nullable: true, type: 'varchar' })
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
  isAnonymized: boolean;

  @Expose()
  @Column({ name: 'anonymized_at', nullable: true, type: 'timestamp' })
  anonymizedAt: Date | null;

  @Expose()
  @Column({ name: 'username', nullable: true, type: 'varchar' })
  username: string | null;

  @Expose()
  @Column({ name: 'first_name', nullable: true, type: 'varchar' })
  firstName: string | null;

  @Expose()
  @Column({ name: 'last_name', nullable: true, type: 'varchar' })
  lastName: string | null;

  @Expose()
  @Index()
  @Column({ name: 'role', default: 'bartender', type: 'varchar' })
  role: string;

  @Expose()
  @Column({ name: 'profile_picture_url', nullable: true, type: 'text' })
  profilePictureUrl: string | null;

  @Expose()
  @Column({ name: 'bio', nullable: true, type: 'text' })
  bio: string | null;

  @Expose()
  @Column({ name: 'date_of_birth', nullable: true, type: 'date' })
  dateOfBirth: Date | null;

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

  @Column({ name: 'token_version', default: 1 })
  tokenVersion: number;

  @Expose()
  @Column({ name: 'temp_new_email', nullable: true, type: 'varchar' })
  tempNewEmail: string | null;

  @Column({ name: 'email_change_token', nullable: true, type: 'varchar' })
  emailChangeToken: string | null;

  @Expose()
  @Index()
  @Column({ name: 'is_active', default: true })
  isActive: boolean;
}
