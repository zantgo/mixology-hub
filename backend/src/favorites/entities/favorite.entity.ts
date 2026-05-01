// src/favorites/entities/favorite.entity.ts
import { Entity, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn, Column, Check } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Cocktail } from '../../cocktails/entities/cocktail.entity';

@Entity('favorites')
@Check('"cocktail_id" IS NOT NULL AND "external_cocktail_id" IS NULL OR "cocktail_id" IS NULL AND "external_cocktail_id" IS NOT NULL')
export class Favorite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Cocktail, { onDelete: 'CASCADE', nullable: true }) 
  @JoinColumn({ name: 'cocktail_id' })
  cocktail: Cocktail | null;

  @Column({ type: 'varchar', nullable: true })
  external_cocktail_id: string | null; 

  @CreateDateColumn()
  created_at: Date;
}
