import { MigrationInterface, QueryRunner } from 'typeorm';

export class BuildBasedCycles0000000000006 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('weekly_cycles');
    if (!table) return;

    if (!table.findColumnByName('app_store_link')) {
      await queryRunner.query(`
        ALTER TABLE weekly_cycles ADD COLUMN app_store_link TEXT
      `);
    }
    if (!table.findColumnByName('google_play_link')) {
      await queryRunner.query(`
        ALTER TABLE weekly_cycles ADD COLUMN google_play_link TEXT
      `);
    }
    if (!table.findColumnByName('closed_at')) {
      await queryRunner.query(`
        ALTER TABLE weekly_cycles ADD COLUMN closed_at TIMESTAMP
      `);
    }
    // Make build_link nullable for backward compat
    const buildLinkCol = table.findColumnByName('build_link');
    if (buildLinkCol && buildLinkCol.isNullable === false) {
      await queryRunner.query(`
        ALTER TABLE weekly_cycles ALTER COLUMN build_link DROP NOT NULL
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('weekly_cycles');
    if (!table) return;

    if (table.findColumnByName('app_store_link')) {
      await queryRunner.dropColumn('weekly_cycles', 'app_store_link');
    }
    if (table.findColumnByName('google_play_link')) {
      await queryRunner.dropColumn('weekly_cycles', 'google_play_link');
    }
    if (table.findColumnByName('closed_at')) {
      await queryRunner.dropColumn('weekly_cycles', 'closed_at');
    }
  }
}
