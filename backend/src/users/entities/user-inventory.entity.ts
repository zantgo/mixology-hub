import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { User } from './user.entity';
import { Ingredient } from '../../ingredients/entities/ingredient.entity';

@Entity('user_inventory')
@Unique(['user', 'ingredient'])
export class UserInventory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Ingredient, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'ingredient_id' })
  ingredient: Ingredient;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  quantity: number;

  @Column({ default: 'units' })
  unit: string;
}
