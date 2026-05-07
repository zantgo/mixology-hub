"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FixArchitecturalInconsistencies1733702400000 = void 0;
class FixArchitecturalInconsistencies1733702400000 {
    name = 'FixArchitecturalInconsistencies1733702400000';
    async up(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE ingredients 
      ADD COLUMN IF NOT EXISTS is_global boolean DEFAULT true,
      ADD COLUMN IF NOT EXISTS normalized_name varchar(255) NOT NULL DEFAULT '';
    `);
        await queryRunner.query(`
      UPDATE ingredients 
      SET normalized_name = UPPER(TRIM(name))
      WHERE normalized_name = '';
    `);
        await queryRunner.query(`
      ALTER TABLE cocktails 
      ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false;
    `);
        await queryRunner.query(`
      ALTER TABLE cocktail_ingredients 
      ALTER COLUMN amount TYPE decimal(10,4);
    `);
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
        await queryRunner.query(`
      ALTER TABLE favorites 
      ALTER COLUMN cocktail_id DROP NOT NULL;
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX IF EXISTS idx_ingredients_global_unique`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_ingredients_custom_unique`);
        await queryRunner.query(`
      ALTER TABLE cocktail_ingredients 
      ALTER COLUMN amount TYPE decimal(10,2);
    `);
        await queryRunner.query(`
      ALTER TABLE ingredients 
      DROP COLUMN IF EXISTS is_global,
      DROP COLUMN IF EXISTS normalized_name;
    `);
        await queryRunner.query(`
      ALTER TABLE cocktails 
      DROP COLUMN IF EXISTS is_deleted;
    `);
        await queryRunner.query(`
      ALTER TABLE favorites 
      ALTER COLUMN cocktail_id SET NOT NULL;
    `);
    }
}
exports.FixArchitecturalInconsistencies1733702400000 = FixArchitecturalInconsistencies1733702400000;
//# sourceMappingURL=1733702400000-fix-architectural-inconsistencies.js.map