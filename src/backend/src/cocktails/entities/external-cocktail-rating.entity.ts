import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Expose } from 'class-transformer';
import { User } from '../../users/entities/user.entity';
import { ColumnFloatTransformer } from '../../utils/column-float.transformer';

@Entity('external_cocktail_ratings')
@Unique(['user', 'externalCocktailId'])
export class ExternalCocktailRating {
  @PrimaryGeneratedColumn('uuid')
  @Expose()
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  @Expose()
  user: User;

  @Column({ name: 'user_id', type: 'varchar', insert: false, update: false })
  userId: string;

  @Column({ name: 'external_cocktail_id', type: 'varchar' })
  @Expose()
  externalCocktailId: string;

  @Column({
    type: 'decimal',
    precision: 3,
    scale: 2,
    transformer: new ColumnFloatTransformer(),
  })
  @Expose()
  score: number;

  @CreateDateColumn({ name: 'created_at' })
  @Expose({ name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  @Expose({ name: 'updatedAt' })
  updatedAt: Date;
}
