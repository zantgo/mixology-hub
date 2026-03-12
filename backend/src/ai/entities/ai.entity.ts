import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('ai_generated_recipes')
export class Ai {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  prompt: string;

  @Column('jsonb')
  generated_recipe: any;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by' })
  user: User;

  @CreateDateColumn()
  created_at: Date;
}
