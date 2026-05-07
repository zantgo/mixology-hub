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
import { Cocktail } from './cocktail.entity';

@Entity('cocktail_ratings')
@Unique(['user', 'cocktail'])
export class CocktailRating {
  @PrimaryGeneratedColumn('uuid')
  @Expose()
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  @Expose()
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => Cocktail, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cocktail_id' })
  @Expose()
  cocktail: Cocktail;

  @Column({ name: 'cocktail_id' })
  cocktailId: string;

  @Column({ type: 'decimal', precision: 3, scale: 2 })
  @Expose()
  score: number;

  @CreateDateColumn({ name: 'created_at' })
  @Expose({ name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  @Expose({ name: 'updatedAt' })
  updatedAt: Date;
}
