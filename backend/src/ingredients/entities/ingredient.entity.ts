import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity('ingredients')
export class Ingredient {
  @ApiProperty({ description: 'Unique identifier of the ingredient' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ example: 'vodka', description: 'The name of the ingredient (must be unique)' })
  @Column({ unique: true })
  name: string;

  /**
   * The base unit of measurement for this ingredient in the system (e.g., 'ml', 'g', 'units').
   * Used for mathematical operations during inventory depletion.
   */
  @ApiProperty({ example: 'ml', description: 'The base unit for this ingredient (ml, g, units)' })
  @Column({ default: 'ml' })
  baseUnit: string;
}
