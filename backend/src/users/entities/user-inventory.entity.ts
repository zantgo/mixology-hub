import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { Decimal } from 'decimal.js';
import { Expose } from 'class-transformer';
import { User } from './user.entity';
import { Ingredient } from '../../ingredients/entities/ingredient.entity';
import { ColumnNumericTransformer } from '../../utils/column-numeric.transformer';

@Entity('user_inventory')
@Unique(['user', 'ingredient'])
export class UserInventory {
  @PrimaryGeneratedColumn('uuid')
  @Expose()
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Ingredient, { onDelete: 'RESTRICT', eager: true })
  @JoinColumn({ name: 'ingredient_id' })
  @Expose()
  ingredient: Ingredient;

  @Column('decimal', { precision: 10, scale: 4, default: 0, transformer: new ColumnNumericTransformer() })
  @Expose()
  quantity: Decimal;

  @CreateDateColumn({ name: 'created_at' })
  @Expose({ name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  @Expose({ name: 'updatedAt' })
  updatedAt: Date;
}
