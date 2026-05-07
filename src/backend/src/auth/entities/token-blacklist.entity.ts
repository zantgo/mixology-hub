import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('token_blacklist')
export class TokenBlacklist {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  @Index()
  token: string;

  @Column()
  reason: string;

  @CreateDateColumn({ name: 'blacklisted_at' })
  blacklistedAt: Date;

  @Column({ name: 'expires_at', type: 'timestamp' })
  @Index()
  expiresAt: Date;
}
