import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmailIndexToPlayers0000000000007 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_players_email ON players(email)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_players_email
    `);
  }
}
