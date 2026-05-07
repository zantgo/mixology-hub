import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Expose } from 'class-transformer';
import { User } from '../../users/entities/user.entity';

export type AuditResultStatus = 'success' | 'error';

@Entity('ai_tool_audit')
export class AiToolAudit {
  @PrimaryGeneratedColumn('uuid')
  @Expose()
  id: string;

  @Column({ name: 'tool_name' })
  @Expose({ name: 'toolName' })
  toolName: string;

  @Column({ type: 'jsonb', nullable: true })
  @Expose()
  arguments: Record<string, unknown> | null;

  @Column({ name: 'result_status' })
  @Expose({ name: 'resultStatus' })
  resultStatus: AuditResultStatus;

  @Column({ name: 'is_write', default: false })
  @Expose({ name: 'isWrite' })
  isWrite: boolean;

  @Column({ name: 'tokens_used', nullable: true })
  @Expose({ name: 'tokensUsed' })
  tokensUsed: number | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'triggered_by' })
  @Expose({ name: 'triggeredBy' })
  triggeredBy: User | null;

  @Column({
    name: 'triggered_by',
    nullable: true,
    insert: false,
    update: false,
  })
  triggeredById: string | null;

  @CreateDateColumn({ name: 'created_at' })
  @Expose({ name: 'createdAt' })
  createdAt: Date;
}
