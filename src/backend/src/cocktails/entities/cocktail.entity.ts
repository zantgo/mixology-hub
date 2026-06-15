import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Expose } from 'class-transformer';
import { User } from '../../users/entities/user.entity';
import { CocktailIngredient } from './cocktail-ingredient.entity';
import { ColumnFloatTransformer } from '../../utils/column-float.transformer';

@Entity('cocktails')
export class Cocktail {
  @PrimaryGeneratedColumn('uuid')
  @Expose()
  id: string;

  @Index()
  @Column()
  @Expose()
  name: string;

  @Column({ type: 'text', nullable: true })
  @Expose()
  description: string;

  @Column({ type: 'text' })
  @Expose()
  instructions: string;

  @Index()
  @Column({ name: 'is_public', default: false })
  @Expose()
  isPublic: boolean;

  @Index()
  @Column({ default: 'local' })
  @Expose()
  source: string; // 'local', 'api', 'ai'

  @Column({ name: 'external_id', type: 'varchar', nullable: true })
  @Expose()
  externalId: string; // ID from TheCocktailDB to prevent duplicates

  @Column({ name: 'parent_external_id', type: 'varchar', nullable: true })
  @Expose()
  parentExternalId: string; // Original external ID when forked from API (UC 2.22 lineage tracking)

  @Column({ name: 'image_full', type: 'varchar', length: 255, nullable: true })
  @Expose()
  imageFull: string; // Path to full-size image (1024x1024 WebP)

  @Column({ name: 'image_thumb', type: 'varchar', length: 255, nullable: true })
  @Expose()
  imageThumb: string; // Path to thumbnail image (300x300 WebP)

  @Column({
    type: 'decimal',
    precision: 3,
    scale: 2,
    nullable: true,
    transformer: new ColumnFloatTransformer(),
  })
  @Expose()
  rating: number | null; // Cached average rating (0.00–5.00)

  @Column({ name: 'rating_count', default: 0 })
  @Expose()
  ratingCount: number; // Number of ratings for average calculation

  @Index()
  @Column({ name: 'is_deleted', default: false })
  @Expose()
  isDeleted: boolean; // Soft delete flag for data integrity

  @Index()
  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by' })
  @Expose()
  user: User | null;

  @OneToMany(() => CocktailIngredient, (ci) => ci.cocktail, { cascade: true })
  @Expose()
  ingredients: CocktailIngredient[];

  @CreateDateColumn({ name: 'created_at' })
  @Expose()
  createdAt: Date;
}
