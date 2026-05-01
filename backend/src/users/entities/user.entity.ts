import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ name: 'display_name' })
  displayName: string;

  @Column({ name: 'password_hash' })
  passwordHash: string;

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

  @Column({ name: 'last_login_at', nullable: true, type: 'timestamp' })
  lastLoginAt: Date | null;

  @Column({ name: 'gdpr_deletion_requested', default: false })
  gdprDeletionRequested: boolean;

  @Column({ name: 'gdpr_deletion_scheduled_at', nullable: true, type: 'timestamp' })
  gdprDeletionScheduledAt: Date | null;

  @Column({ name: 'is_anonymized', default: false })
  is_anonymized: boolean;

  @Column({ name: 'anonymized_at', nullable: true, type: 'timestamp' })
  anonymized_at: Date | null;

  @Column({ name: 'username', nullable: true })
  username: string | null;

  @Column({ name: 'first_name', nullable: true })
  first_name: string | null;

  @Column({ name: 'last_name', nullable: true })
  last_name: string | null;

  @Column({ name: 'role', default: 'user' })
  role: string;

  @Column({ name: 'profile_picture_url', nullable: true, type: 'text' })
  profile_picture_url: string | null;

  @Column({ name: 'bio', nullable: true, type: 'text' })
  bio: string | null;

  @Column({ name: 'date_of_birth', nullable: true, type: 'date' })
  date_of_birth: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updatedAt: Date;

  // Indexes for performance
  @Index()
  @Column({ name: 'is_active', default: true })
  isActive: boolean;
}
