import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPgTrgm1746496000000 implements MigrationInterface {
  name = 'AddPgTrgm1746496000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_ingredients_name_trgm
       ON ingredients USING gin (normalized_name gin_trgm_ops)`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_cocktails_name_trgm
       ON cocktails USING gin (name gin_trgm_ops)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_cocktails_name_trgm`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_ingredients_name_trgm`);
  }
}
