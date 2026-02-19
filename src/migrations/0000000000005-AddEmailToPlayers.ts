import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmailToPlayers0000000000005 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const playersTable = await queryRunner.getTable('players');
    
    if (playersTable) {
      // Add email column
      const emailColumn = playersTable.findColumnByName('email');
      if (!emailColumn) {
        await queryRunner.query(`
          ALTER TABLE players 
          ADD COLUMN email TEXT
        `);
      }

      // Add index on player_id if it doesn't exist
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_players_player_id ON players(player_id)
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const playersTable = await queryRunner.getTable('players');
    
    if (playersTable) {
      // Remove email column
      const emailColumn = playersTable.findColumnByName('email');
      if (emailColumn) {
        await queryRunner.dropColumn('players', 'email');
      }

      // Remove index on player_id
      const index = playersTable.indices.find(idx => idx.name === 'idx_players_player_id');
      if (index) {
        await queryRunner.dropIndex('players', 'idx_players_player_id');
      }
    }
  }
}
