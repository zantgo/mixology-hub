import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { CocktailIngredient } from './cocktail-ingredient.entity';

@Entity('cocktails')
export class Cocktail {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'text' })
  instructions: string;

  @Column({ default: false })
  is_public: boolean;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'created_by' })
  user: User;

  @OneToMany(() => CocktailIngredient, (ci) => ci.cocktail, { cascade: true })
  ingredients: CocktailIngredient[];

  @CreateDateColumn()
  created_at: Date;
}
