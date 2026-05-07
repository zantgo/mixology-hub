import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Decimal } from 'decimal.js';
import { Expose, Transform } from 'class-transformer';
import { Ingredient } from '../../ingredients/entities/ingredient.entity';
import { ColumnNumericTransformer } from '../../utils/column-numeric.transformer';

@Entity('bar_inventory')
@Unique(['ingredient'])
export class BarInventory {
  @PrimaryGeneratedColumn('uuid')
  @Expose()
  id: string;

  @ManyToOne(() => Ingredient, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'ingredient_id' })
  @Expose()
  ingredient: Ingredient;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 4,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  @Expose()
  @Transform(({ value }) => value?.toString())
  quantity: Decimal;

  @Column({ name: 'expiration_date', type: 'timestamp', nullable: true })
  @Expose({ name: 'expirationDate' })
  expirationDate: Date | null;

  @UpdateDateColumn({ name: 'updated_at' })
  @Expose({ name: 'updatedAt' })
  updatedAt: Date;
}
