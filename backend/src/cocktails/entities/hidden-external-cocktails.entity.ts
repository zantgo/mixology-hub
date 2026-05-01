import { Entity, Column, CreateDateColumn, ManyToOne, JoinColumn, PrimaryColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('hidden_external_cocktails')
export class HiddenExternalCocktails {
  @PrimaryColumn({ name: 'external_id' })
  externalId: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'hidden_by' })
  hiddenBy: User | null;

  @Column()
  reason: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
