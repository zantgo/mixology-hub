import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { Decimal } from 'decimal.js';
import { User } from './user.entity';
import { Ingredient } from '../../ingredients/entities/ingredient.entity';
import { ColumnNumericTransformer } from '../../utils/column-numeric.transformer';

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

  @Column('decimal', { precision: 10, scale: 4, default: 0, transformer: new ColumnNumericTransformer() })
  quantity: Decimal;

  @Column({ default: 'count' })
  unit: string;
}
