// src/favorites/entities/favorite.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Column,
  Check,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Cocktail } from '../../cocktails/entities/cocktail.entity';

@Entity('favorites')
@Check(
  '"cocktail_id" IS NOT NULL AND "external_cocktail_id" IS NULL OR "cocktail_id" IS NULL AND "external_cocktail_id" IS NOT NULL',
)
@Index('idx_fav_local', ['user', 'cocktail'], {
  unique: true,
  where: 'cocktail_id IS NOT NULL',
})
@Index('idx_fav_external', ['user', 'externalCocktailId'], {
  unique: true,
  where: 'external_cocktail_id IS NOT NULL',
})
export class Favorite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Cocktail, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'cocktail_id' })
  cocktail: Cocktail | null;

  @Column({ name: 'external_cocktail_id', type: 'varchar', nullable: true })
  externalCocktailId: string | null;

  @Column({
    name: 'external_name',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  externalName: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
