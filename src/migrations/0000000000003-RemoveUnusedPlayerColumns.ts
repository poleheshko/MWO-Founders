import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveUnusedPlayerColumns0000000000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const playersTable = await queryRunner.getTable('players');
    
    if (playersTable) {
      // Remove columns that are no longer needed
      const columnsToRemove = [
        'mwo_username',
        'roles',
        'player_level',
        'board_value',
        'server_join_date',
        'account_creation_date',
        'top_role',
      ];

      for (const columnName of columnsToRemove) {
        const column = playersTable.findColumnByName(columnName);
        if (column) {
          await queryRunner.dropColumn('players', columnName);
        }
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const playersTable = await queryRunner.getTable('players');
    
    if (playersTable) {
      // Re-add the columns (as nullable TEXT columns)
      await queryRunner.query(`
        ALTER TABLE players 
        ADD COLUMN IF NOT EXISTS mwo_username TEXT
      `);

      await queryRunner.query(`
        ALTER TABLE players 
        ADD COLUMN IF NOT EXISTS roles TEXT
      `);

      await queryRunner.query(`
        ALTER TABLE players 
        ADD COLUMN IF NOT EXISTS player_level TEXT
      `);

      await queryRunner.query(`
        ALTER TABLE players 
        ADD COLUMN IF NOT EXISTS board_value TEXT
      `);

      await queryRunner.query(`
        ALTER TABLE players 
        ADD COLUMN IF NOT EXISTS server_join_date TEXT
      `);

      await queryRunner.query(`
        ALTER TABLE players 
        ADD COLUMN IF NOT EXISTS account_creation_date TEXT
      `);

      await queryRunner.query(`
        ALTER TABLE players 
        ADD COLUMN IF NOT EXISTS top_role TEXT
      `);
    }
  }
}
