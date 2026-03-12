import { Entity, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn, Column } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Cocktail } from '../../cocktails/entities/cocktail.entity';

@Entity('favorites')
export class Favorite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  // Relación con un cóctel local (Opcional)
  @ManyToOne(() => Cocktail, { onDelete: 'CASCADE', nullable: true }) 
  @JoinColumn({ name: 'cocktail_id' })
  cocktail: Cocktail;

  // ID de la API pública si el usuario guardó una receta de TheCocktailDB (Opcional)
  @Column({ nullable: true })
  external_cocktail_id: string; 

  @CreateDateColumn()
  created_at: Date;
}
