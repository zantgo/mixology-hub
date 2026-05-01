import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('user_profiles')
export class UserProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'unit_system', default: 'metric' })
  unitSystem: string;

  @Column({ default: 'system' })
  theme: string;

  @Column({ name: 'default_servings', default: 1 })
  defaultServings: number;

  @Column({ name: 'default_part_size', default: 30 })
  defaultPartSize: number;

  @Column({ name: 'show_tutorial', default: true })
  showTutorial: boolean;
}
