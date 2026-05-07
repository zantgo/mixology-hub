import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('ai_generated_recipes')
export class Ai {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  prompt: string;

  @Column('jsonb', { name: 'generated_recipe' })
  generated_recipe: any;

  @Column('jsonb', { name: 'recipe_data', nullable: true })
  recipe_data: any;

  @Column('float', { name: 'validation_score', nullable: true })
  validation_score: number;

  @Column('boolean', { name: 'is_valid', default: false })
  is_valid: boolean;

  @Column('uuid', { name: 'saved_as_cocktail_id', nullable: true })
  saved_as_cocktail_id: string;

  @Column('int', { name: 'attempts', default: 0 })
  attempts: number;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by' })
  user: User;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
