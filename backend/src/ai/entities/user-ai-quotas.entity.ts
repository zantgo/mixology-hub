import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Unique, UpdateDateColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('user_ai_quotas')
@Unique(['user', 'quotaDate'])
export class UserAiQuotas {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'quota_date', type: 'date' })
  quotaDate: string;

  @Column({ name: 'usage_count', default: 0 })
  usageCount: number;

  @UpdateDateColumn({ name: 'last_updated_at' })
  lastUpdatedAt: Date;
}
