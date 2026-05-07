import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class FixArchitecturalInconsistencies1733702400000 implements MigrationInterface {
    name: string;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}
