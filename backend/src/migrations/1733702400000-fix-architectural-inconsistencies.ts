import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixArchitecturalInconsistencies1733702400000 implements MigrationInterface {
  name = 'FixArchitecturalInconsistencies1733702400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add is_global and normalized_name to ingredients table
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

    // 2. Add is_deleted to cocktails table
    await queryRunner.query(`
      ALTER TABLE cocktails 
      ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false;
    `);

    // 3. Update cocktail_ingredients.amount precision from decimal(10,2) to decimal(10,4)
    await queryRunner.query(`
      ALTER TABLE cocktail_ingredients 
      ALTER COLUMN amount TYPE decimal(10,4);
    `);

    // 4. Create partial unique indexes for ingredients
    // Global ingredients: unique normalized_name where is_global = true
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_ingredients_global_unique 
      ON ingredients (normalized_name) 
      WHERE is_global = true;
    `);

    // Custom ingredients: unique normalized_name per user where is_global = false
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_ingredients_custom_unique 
      ON ingredients (normalized_name, created_by) 
      WHERE is_global = false;
    `);

    // 5. Create sync_operations table for offline sync idempotency
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS sync_operations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        client_operation_id uuid NOT NULL,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        operation_type varchar(50) NOT NULL,
        payload jsonb NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'pending',
        error_message text,
        device_timestamp timestamp NOT NULL,
        server_timestamp timestamp,
        created_at timestamp DEFAULT NOW(),
        updated_at timestamp DEFAULT NOW(),
        UNIQUE(client_operation_id, user_id)
      );

      CREATE INDEX IF NOT EXISTS idx_sync_operations_user_status 
      ON sync_operations(user_id, status);

      CREATE INDEX IF NOT EXISTS idx_sync_operations_client_id 
      ON sync_operations(client_operation_id);
    `);

    // 6. Make favorites.cocktail_id nullable for polymorphic favorites
    await queryRunner.query(`
      ALTER TABLE favorites 
      ALTER COLUMN cocktail_id DROP NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS idx_ingredients_global_unique`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_ingredients_custom_unique`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_sync_operations_user_status`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_sync_operations_client_id`);

    // Drop sync_operations table
    await queryRunner.query(`DROP TABLE IF EXISTS sync_operations`);

    // Revert cocktail_ingredients.amount precision
    await queryRunner.query(`
      ALTER TABLE cocktail_ingredients 
      ALTER COLUMN amount TYPE decimal(10,2);
    `);

    // Remove columns
    await queryRunner.query(`
      ALTER TABLE ingredients 
      DROP COLUMN IF EXISTS is_global,
      DROP COLUMN IF EXISTS normalized_name;
    `);

    await queryRunner.query(`
      ALTER TABLE cocktails 
      DROP COLUMN IF EXISTS is_deleted;
    `);

    // Revert favorites.cocktail_id to NOT NULL
    await queryRunner.query(`
      ALTER TABLE favorites 
      ALTER COLUMN cocktail_id SET NOT NULL;
    `);
  }
}