import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('ingredients')
export class Ingredient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Quitamos 'lowercase' porque no existe. 
  // 'unique' lo ponemos en un objeto de opciones simple.
  @Column({ unique: true })
  name: string;
}
