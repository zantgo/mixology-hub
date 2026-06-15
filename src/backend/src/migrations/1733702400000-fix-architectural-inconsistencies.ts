import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixArchitecturalInconsistencies1733702400000 implements MigrationInterface {
  name = 'FixArchitecturalInconsistencies1733702400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add is_global and normalized_name to ingredients table
    if (await queryRunner.hasTable('ingredients')) {
      await queryRunner.query(`
        ALTER TABLE ingredients 
        ADD COLUMN IF NOT EXISTS is_global boolean DEFAULT true,
        ADD COLUMN IF NOT EXISTS normalized_name varchar(255) NOT NULL DEFAULT '';
      `);

      // Update normalized_name from existing name column
      await queryRunner.query(`
        UPDATE ingredients 
        SET normalized_name = UPPER(TRIM(name))
        WHERE normalized_name = '';
      `);

      // Create partial unique indexes
      await queryRunner.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_ingredients_global_unique 
        ON ingredients (normalized_name) 
        WHERE is_global = true;
      `);

      await queryRunner.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_ingredients_custom_unique 
        ON ingredients (normalized_name, created_by) 
        WHERE is_global = false;
      `);
    }

    // 2. Add is_deleted to cocktails table
    if (await queryRunner.hasTable('cocktails')) {
      await queryRunner.query(`
        ALTER TABLE cocktails 
        ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false;
      `);
    }

    // 3. Update cocktail_ingredients.amount precision from decimal(10,2) to decimal(10,4)
    if (await queryRunner.hasTable('cocktail_ingredients')) {
      await queryRunner.query(`
        ALTER TABLE cocktail_ingredients 
        ALTER COLUMN amount TYPE decimal(10,4);
      `);
    }

    // 4. Make favorites.cocktail_id nullable for polymorphic favorites
    if (await queryRunner.hasTable('favorites')) {
      await queryRunner.query(`
        ALTER TABLE favorites 
        ALTER COLUMN cocktail_id DROP NOT NULL;
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    if (await queryRunner.hasTable('ingredients')) {
      await queryRunner.query(
        `DROP INDEX IF EXISTS idx_ingredients_global_unique`,
      );
      await queryRunner.query(
        `DROP INDEX IF EXISTS idx_ingredients_custom_unique`,
      );

      // Remove columns
      await queryRunner.query(`
        ALTER TABLE ingredients 
        DROP COLUMN IF EXISTS is_global,
        DROP COLUMN IF EXISTS normalized_name;
      `);
    }

    // Revert cocktail_ingredients.amount precision
    if (await queryRunner.hasTable('cocktail_ingredients')) {
      await queryRunner.query(`
        ALTER TABLE cocktail_ingredients 
        ALTER COLUMN amount TYPE decimal(10,2);
      `);
    }

    if (await queryRunner.hasTable('cocktails')) {
      await queryRunner.query(`
        ALTER TABLE cocktails 
        DROP COLUMN IF EXISTS is_deleted;
      `);
    }

    // Revert favorites.cocktail_id to NOT NULL
    if (await queryRunner.hasTable('favorites')) {
      await queryRunner.query(`
        ALTER TABLE favorites 
        ALTER COLUMN cocktail_id SET NOT NULL;
      `);
    }
  }
}
