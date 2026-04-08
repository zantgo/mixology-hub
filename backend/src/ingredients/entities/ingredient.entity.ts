import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn, Index } from 'typeorm';
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

  /**
   * Hierarchical relationship: parent ingredient (e.g., Bourbon → Whiskey)
   * NULL for top-level ingredients
   */
  @ApiProperty({ description: 'Parent ingredient for hierarchical relationships' })
  @ManyToOne(() => Ingredient, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'parent_id' })
  parent: Ingredient | null;

  @Column({ name: 'parent_id', nullable: true })
  parentId: string | null;

  /**
   * Child ingredients in the hierarchy
   */
  @OneToMany(() => Ingredient, (ingredient) => ingredient.parent)
  children: Ingredient[];

  /**
   * Synonyms for ingredient matching (e.g., "Scotch" = "Scotch Whisky")
   * Stored as comma-separated values
   */
  @ApiProperty({ example: 'Scotch Whisky,Scotch', description: 'Comma-separated synonyms for ingredient matching' })
  @Column({ type: 'text', nullable: true })
  synonyms: string | null;

  /**
   * GDPR compliance: track who created user-generated ingredients
   * NULL for system/default ingredients
   */
  @ApiProperty({ description: 'User who created this ingredient (NULL for system ingredients)' })
  @Column({ name: 'created_by', nullable: true })
  createdBy: string | null;

  /**
   * Index for faster hierarchical queries
   */
  @Index()
  @Column({ name: 'hierarchy_level', default: 0 })
  hierarchyLevel: number;
}
