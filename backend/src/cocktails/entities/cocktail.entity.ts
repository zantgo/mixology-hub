import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Expose } from 'class-transformer';
import { User } from '../../users/entities/user.entity';
import { CocktailIngredient } from './cocktail-ingredient.entity';

@Entity('cocktails')
export class Cocktail {
  @PrimaryGeneratedColumn('uuid')
  @Expose()
  id: string;

  @Column()
  @Expose()
  name: string;

  @Column({ type: 'text', nullable: true })
  @Expose()
  description: string;

  @Column({ type: 'text' })
  @Expose()
  instructions: string;

  @Column({ default: false })
  @Expose({ name: 'isPublic' })
  is_public: boolean;

  @Column({ default: 'local' })
  @Expose()
  source: string; // 'local', 'api', 'ai'

  @Column({ nullable: true })
  @Expose({ name: 'externalId' })
  external_id: string; // ID from TheCocktailDB to prevent duplicates

  @Column({ name: 'image_full', type: 'varchar', length: 255, nullable: true })
  @Expose({ name: 'imageFull' })
  image_full: string; // Path to full-size image (1024x1024 WebP)

  @Column({ name: 'image_thumb', type: 'varchar', length: 255, nullable: true })
  @Expose({ name: 'imageThumb' })
  image_thumb: string; // Path to thumbnail image (300x300 WebP)

  @Column({ name: 'is_deleted', default: false })
  @Expose({ name: 'isDeleted' })
  is_deleted: boolean; // Soft delete flag for data integrity

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'created_by' })
  @Expose()
  user: User;

  @OneToMany(() => CocktailIngredient, (ci) => ci.cocktail, { cascade: true })
  @Expose()
  ingredients: CocktailIngredient[];

  @CreateDateColumn()
  @Expose({ name: 'createdAt' })
  created_at: Date;
}
