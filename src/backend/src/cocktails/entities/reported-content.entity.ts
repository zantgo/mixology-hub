import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Cocktail } from './cocktail.entity';

@Entity('reported_content')
export class ReportedContent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'reported_by' })
  reportedBy: User | null;

  @Index()
  @ManyToOne(() => Cocktail, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'cocktail_id' })
  cocktail: Cocktail | null;

  @Index()
  @Column({ name: 'external_cocktail_id', type: 'varchar', nullable: true })
  externalCocktailId: string;

  @Column({ name: 'report_reason' })
  reportReason: string;

  @Column({ type: 'varchar', nullable: true })
  details: string;

  @Column({ default: 'pending' })
  status: string;

  @Index()
  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'reviewed_by' })
  reviewedBy: User | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'reviewed_at', nullable: true, type: 'timestamp' })
  reviewedAt: Date | null;
}
