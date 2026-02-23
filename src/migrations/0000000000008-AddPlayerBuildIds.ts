import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPlayerBuildIds0000000000008 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "player_build_ids" (
        "discord_id" TEXT NOT NULL,
        "build_version" TEXT NOT NULL,
        "player_id" TEXT NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        PRIMARY KEY ("discord_id", "build_version")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_player_build_ids_discord_build" ON "player_build_ids" ("discord_id", "build_version")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_player_build_ids_build_player" ON "player_build_ids" ("build_version", "player_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "player_build_ids"`);
  }
}
