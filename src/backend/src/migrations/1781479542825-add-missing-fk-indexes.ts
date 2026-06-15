import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMissingFkIndexes1781479542825 implements MigrationInterface {
  name = 'AddMissingFkIndexes1781479542825';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_preparation_logs_bartender
      ON preparation_logs (bartender_id);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_preparation_logs_cocktail
      ON preparation_logs (cocktail_id);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_reported_content_reported_by
      ON reported_content (reported_by);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_reported_content_cocktail
      ON reported_content (cocktail_id);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_reported_content_reviewed_by
      ON reported_content (reviewed_by);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_preparation_logs_bartender;`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_preparation_logs_cocktail;`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_reported_content_reported_by;`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_reported_content_cocktail;`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_reported_content_reviewed_by;`,
    );
  }
}
