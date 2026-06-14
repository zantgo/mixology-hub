import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Expose } from 'class-transformer';
import { User } from '../../users/entities/user.entity';
import { Cocktail } from './cocktail.entity';

export type PreparationStatus =
  | 'queued'
  | 'evaluating'
  | 'preparing'
  | 'completed'
  | 'failed_insufficient_stock'
  | 'failed_other'
  | 'cancelled';

@Entity('preparation_logs')
export class PreparationLog {
  @PrimaryGeneratedColumn('uuid')
  @Expose()
  id: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'bartender_id' })
  @Expose()
  bartender: User | null;

  @Column({
    name: 'bartender_id',
    nullable: true,
    insert: false,
    update: false,
  })
  bartenderId: string | null;

  @ManyToOne(() => Cocktail, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'cocktail_id' })
  @Expose()
  cocktail: Cocktail | null;

  @Column({ name: 'cocktail_id', nullable: true, insert: false, update: false })
  cocktailId: string | null;

  @Column({ name: 'external_cocktail_id', nullable: true })
  @Expose({ name: 'externalCocktailId' })
  externalCocktailId: string | null;

  @Column({ name: 'cocktail_name_snapshot', nullable: true })
  @Expose({ name: 'cocktailNameSnapshot' })
  cocktailNameSnapshot: string | null;

  @Column({ default: 1 })
  @Expose()
  servings: number;

  @Column({ type: 'jsonb', nullable: true, name: 'deducted_ingredients' })
  @Expose({ name: 'deductedIngredients' })
  deductedIngredients: Record<string, unknown>[] | null;

  @Column({
    type: 'varchar',
    length: 32,
    default: 'queued',
  })
  @Expose()
  status: PreparationStatus;

  @Column({ default: false })
  @Expose()
  undone: boolean;

  @Index()
  @CreateDateColumn({ name: 'created_at' })
  @Expose({ name: 'createdAt' })
  createdAt: Date;
}
