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
export class AiGeneratedRecipe {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  prompt: string;

  @Column('jsonb', { name: 'generated_recipe', nullable: true })
  generatedRecipe: any;

  @Column('jsonb', { name: 'recipe_data', nullable: true })
  recipeData: any;

  @Column('float', { name: 'validation_score', nullable: true })
  validationScore: number;

  @Column('boolean', { name: 'is_valid', default: false })
  isValid: boolean;

  @Column('uuid', { name: 'saved_as_cocktail_id', nullable: true })
  savedAsCocktailId: string;

  @Column('int', { name: 'attempts', default: 0 })
  attempts: number;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by' })
  user: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
