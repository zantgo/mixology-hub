import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
  BeforeInsert,
  BeforeUpdate,
  Check,
} from 'typeorm';
import { Decimal } from 'decimal.js';
import { ApiProperty } from '@nestjs/swagger';
import { ColumnNumericTransformer } from '../../utils/column-numeric.transformer';
import { Transform } from 'class-transformer';

@Entity('ingredients')
@Check('"density" > 0')
export class Ingredient {
  @ApiProperty({ description: 'Unique identifier of the ingredient' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({
    example: 'vodka',
    description:
      'The name of the ingredient (must be unique per user for custom ingredients)',
  })
  @Column()
  name: string;

  /**
   * The base unit of measurement for this ingredient in the system (e.g., 'ml', 'g', 'count').
   * Used for mathematical operations during inventory depletion.
   */
  @ApiProperty({
    example: 'ml',
    description: 'The base unit for this ingredient (ml, g, count)',
  })
  @Column({ default: 'ml' })
  baseUnit: string;

  /**
   * Hierarchical relationship: parent ingredient (e.g., Bourbon → Whiskey)
   * NULL for top-level ingredients
   */
  @ApiProperty({
    description: 'Parent ingredient for hierarchical relationships',
  })
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
   * Whether this ingredient is a global/system ingredient or user-created custom ingredient
   * Global ingredients (is_global = true) are shared across all users
   * Custom ingredients (is_global = false) are user-specific
   */
  @ApiProperty({
    example: true,
    description:
      'Whether this is a global/system ingredient (true) or user-created custom ingredient (false)',
  })
  @Column({ name: 'is_global', default: true })
  isGlobal: boolean;

  /**
   * Normalized name for case-insensitive matching and deduplication
   * Used for partial unique index with (normalized_name, created_by, is_global)
   */
  @ApiProperty({
    example: 'VODKA',
    description: 'Normalized uppercase name for case-insensitive matching',
  })
  @Column({ name: 'normalized_name' })
  normalizedName: string;

  /**
   * Synonyms for ingredient matching (e.g., "Scotch" = "Scotch Whisky")
   * Stored as comma-separated values
   */
  @ApiProperty({
    example: 'Scotch Whisky,Scotch',
    description: 'Comma-separated synonyms for ingredient matching',
  })
  @Column({ type: 'text', nullable: true })
  synonyms: string | null;

  /**
   * GDPR compliance: track who created user-generated ingredients
   * NULL for system/default ingredients
   */
  @ApiProperty({
    description:
      'User who created this ingredient (NULL for system ingredients)',
  })
  @Column({ name: 'created_by', nullable: true })
  createdBy: string | null;

  /**
   * Index for faster hierarchical queries
   */
  @Index()
  @Column({ name: 'hierarchy_level', default: 0 })
  hierarchyLevel: number;

  /**
   * Density in g/ml for mass-to-volume conversions
   * Used when converting between weight (g/kg) and volume (ml/l/oz/cl) units
   * Default is 1.0 (water density)
   */
  @ApiProperty({
    example: 1.0,
    description: 'Density in g/ml for mass-volume conversions',
  })
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 4,
    default: 1.0,
    transformer: new ColumnNumericTransformer(),
  })
  @Transform(({ value }) => value?.toString())
  density: Decimal;

  /**
   * Whether this ingredient allows cross-conversion between mass and volume
   * Some ingredients (like "units" or custom ingredients without known density) should not allow conversions
   */
  @ApiProperty({
    example: true,
    description: 'Whether mass-volume conversions are allowed',
  })
  @Column({ name: 'allow_mass_volume_conversion', default: true })
  allowMassVolumeConversion: boolean;

  @BeforeInsert()
  @BeforeUpdate()
  normalizeName() {
    if (this.name) {
      this.normalizedName = this.name.toUpperCase().trim();
    }
  }
}
