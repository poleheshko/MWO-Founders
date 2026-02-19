import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey } from 'typeorm';

export class RenameUsersToPlayers0000000000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if users table exists
    const usersTable = await queryRunner.getTable('users');
    
    if (usersTable) {
      // Step 1: Create players table with new structure
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS players (
          discord_id TEXT PRIMARY KEY,
          discord_username TEXT,
          discord_nickname TEXT,
          player_id TEXT,
          mwo_username TEXT,
          roles TEXT,
          player_level TEXT,
          board_value TEXT,
          server_join_date TEXT,
          account_creation_date TEXT,
          top_role TEXT,
          created_at TIMESTAMP DEFAULT now(),
          updated_at TIMESTAMP DEFAULT now()
        )
      `);

      // Step 2: Migrate data from users to players
      // Convert discord_user_id (bigint) to discord_id (text)
      // Check which columns exist in players table
      const playersTable = await queryRunner.getTable('players');
      const hasOldColumns = playersTable?.columns.some(col => 
        ['mwo_username', 'roles', 'player_level', 'board_value', 'server_join_date', 'account_creation_date', 'top_role'].includes(col.name)
      );

      if (hasOldColumns) {
        // Old structure with all columns
        await queryRunner.query(`
          INSERT INTO players (
            discord_id,
            discord_username,
            discord_nickname,
            player_id,
            mwo_username,
            roles,
            player_level,
            board_value,
            server_join_date,
            account_creation_date,
            top_role,
            created_at,
            updated_at
          )
          SELECT 
            discord_user_id::text as discord_id,
            discord_username,
            display_name as discord_nickname,
            NULL as player_id,
            NULL as mwo_username,
            NULL as roles,
            NULL as player_level,
            NULL as board_value,
            NULL as server_join_date,
            NULL as account_creation_date,
            NULL as top_role,
            created_at,
            updated_at
          FROM users
          ON CONFLICT (discord_id) DO NOTHING
        `);
      } else {
        // New structure without old columns
        await queryRunner.query(`
          INSERT INTO players (
            discord_id,
            discord_username,
            discord_nickname,
            player_id,
            created_at,
            updated_at
          )
          SELECT 
            discord_user_id::text as discord_id,
            discord_username,
            display_name as discord_nickname,
            NULL as player_id,
            created_at,
            updated_at
          FROM users
          ON CONFLICT (discord_id) DO NOTHING
        `);
      }

      // Step 3: Drop foreign keys that reference users table
      const armyTestersTable = await queryRunner.getTable('army_testers');
      if (armyTestersTable) {
        const fk = armyTestersTable.foreignKeys.find(
          (fk) => fk.columnNames.includes('discord_user_id') && fk.referencedTableName === 'users'
        );
        if (fk) {
          await queryRunner.dropForeignKey('army_testers', fk);
        }
      }

      const weeklyCyclesTable = await queryRunner.getTable('weekly_cycles');
      if (weeklyCyclesTable) {
        const fk = weeklyCyclesTable.foreignKeys.find(
          (fk) => fk.columnNames.includes('created_by') && fk.referencedTableName === 'users'
        );
        if (fk) {
          await queryRunner.dropForeignKey('weekly_cycles', fk);
        }
      }

      const submissionsTable = await queryRunner.getTable('submissions');
      if (submissionsTable) {
        const fk1 = submissionsTable.foreignKeys.find(
          (fk) => fk.columnNames.includes('discord_user_id') && fk.referencedTableName === 'users'
        );
        if (fk1) {
          await queryRunner.dropForeignKey('submissions', fk1);
        }
        
        const fk2 = submissionsTable.foreignKeys.find(
          (fk) => fk.columnNames.includes('reviewed_by') && fk.referencedTableName === 'users'
        );
        if (fk2) {
          await queryRunner.dropForeignKey('submissions', fk2);
        }
      }

      const issuesTable = await queryRunner.getTable('issues');
      if (issuesTable) {
        const fk = issuesTable.foreignKeys.find(
          (fk) => fk.columnNames.includes('reporter_user_id') && fk.referencedTableName === 'users'
        );
        if (fk) {
          await queryRunner.dropForeignKey('issues', fk);
        }
      }

      // Step 4: Update column types in related tables
      // Change discord_user_id from bigint to text in army_testers
      await queryRunner.query(`
        ALTER TABLE army_testers 
        ALTER COLUMN discord_user_id TYPE TEXT USING discord_user_id::text
      `);

      // Change created_by from bigint to text in weekly_cycles
      await queryRunner.query(`
        ALTER TABLE weekly_cycles 
        ALTER COLUMN created_by TYPE TEXT USING created_by::text
      `);

      // Change discord_user_id from bigint to text in submissions
      await queryRunner.query(`
        ALTER TABLE submissions 
        ALTER COLUMN discord_user_id TYPE TEXT USING discord_user_id::text
      `);

      // Change reviewed_by from bigint to text in submissions
      await queryRunner.query(`
        ALTER TABLE submissions 
        ALTER COLUMN reviewed_by TYPE TEXT USING reviewed_by::text
      `);

      // Change reporter_user_id from bigint to text in issues
      await queryRunner.query(`
        ALTER TABLE issues 
        ALTER COLUMN reporter_user_id TYPE TEXT USING reporter_user_id::text
      `);

      // Step 5: Recreate foreign keys pointing to players table
      // Check if foreign key already exists before creating
      const armyTestersTableAfter = await queryRunner.getTable('army_testers');
      const fkExists = armyTestersTableAfter?.foreignKeys.find(
        (fk) => fk.columnNames.includes('discord_user_id') && fk.referencedTableName === 'players'
      );
      if (!fkExists) {
        await queryRunner.createForeignKey(
          'army_testers',
          new TableForeignKey({
            columnNames: ['discord_user_id'],
            referencedTableName: 'players',
            referencedColumnNames: ['discord_id'],
            onDelete: 'CASCADE',
          })
        );
      }

      // Check if foreign key already exists before creating
      const weeklyCyclesTableAfter = await queryRunner.getTable('weekly_cycles');
      const weeklyCyclesFkExists = weeklyCyclesTableAfter?.foreignKeys.find(
        (fk) => fk.columnNames.includes('created_by') && fk.referencedTableName === 'players'
      );
      if (!weeklyCyclesFkExists) {
        await queryRunner.createForeignKey(
          'weekly_cycles',
          new TableForeignKey({
            columnNames: ['created_by'],
            referencedTableName: 'players',
            referencedColumnNames: ['discord_id'],
            onDelete: 'SET NULL',
          })
        );
      }

      const submissionsTableAfter = await queryRunner.getTable('submissions');
      const submissionsFk1Exists = submissionsTableAfter?.foreignKeys.find(
        (fk) => fk.columnNames.includes('discord_user_id') && fk.referencedTableName === 'players'
      );
      if (!submissionsFk1Exists) {
        await queryRunner.createForeignKey(
          'submissions',
          new TableForeignKey({
            columnNames: ['discord_user_id'],
            referencedTableName: 'players',
            referencedColumnNames: ['discord_id'],
            onDelete: 'CASCADE',
          })
        );
      }

      const submissionsFk2Exists = submissionsTableAfter?.foreignKeys.find(
        (fk) => fk.columnNames.includes('reviewed_by') && fk.referencedTableName === 'players'
      );
      if (!submissionsFk2Exists) {
        await queryRunner.createForeignKey(
          'submissions',
          new TableForeignKey({
            columnNames: ['reviewed_by'],
            referencedTableName: 'players',
            referencedColumnNames: ['discord_id'],
            onDelete: 'SET NULL',
          })
        );
      }

      const issuesTableAfter = await queryRunner.getTable('issues');
      const issuesFkExists = issuesTableAfter?.foreignKeys.find(
        (fk) => fk.columnNames.includes('reporter_user_id') && fk.referencedTableName === 'players'
      );
      if (!issuesFkExists) {
        await queryRunner.createForeignKey(
          'issues',
          new TableForeignKey({
            columnNames: ['reporter_user_id'],
            referencedTableName: 'players',
            referencedColumnNames: ['discord_id'],
            onDelete: 'CASCADE',
          })
        );
      }

      // Step 6: Create index on players.discord_username
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_players_username ON players(discord_username)
      `);

      // Step 7: Drop old users table
      await queryRunner.dropTable('users', true);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse migration: recreate users table from players
    const playersTable = await queryRunner.getTable('players');
    
    if (playersTable) {
      // Drop foreign keys
      const armyTestersTable = await queryRunner.getTable('army_testers');
      if (armyTestersTable) {
        const fk = armyTestersTable.foreignKeys.find(
          (fk) => fk.columnNames.includes('discord_user_id') && fk.referencedTableName === 'players'
        );
        if (fk) {
          await queryRunner.dropForeignKey('army_testers', fk);
        }
      }

      const weeklyCyclesTable = await queryRunner.getTable('weekly_cycles');
      if (weeklyCyclesTable) {
        const fk = weeklyCyclesTable.foreignKeys.find(
          (fk) => fk.columnNames.includes('created_by') && fk.referencedTableName === 'players'
        );
        if (fk) {
          await queryRunner.dropForeignKey('weekly_cycles', fk);
        }
      }

      const submissionsTable = await queryRunner.getTable('submissions');
      if (submissionsTable) {
        const fk1 = submissionsTable.foreignKeys.find(
          (fk) => fk.columnNames.includes('discord_user_id') && fk.referencedTableName === 'players'
        );
        if (fk1) {
          await queryRunner.dropForeignKey('submissions', fk1);
        }
        
        const fk2 = submissionsTable.foreignKeys.find(
          (fk) => fk.columnNames.includes('reviewed_by') && fk.referencedTableName === 'players'
        );
        if (fk2) {
          await queryRunner.dropForeignKey('submissions', fk2);
        }
      }

      const issuesTable = await queryRunner.getTable('issues');
      if (issuesTable) {
        const fk = issuesTable.foreignKeys.find(
          (fk) => fk.columnNames.includes('reporter_user_id') && fk.referencedTableName === 'players'
        );
        if (fk) {
          await queryRunner.dropForeignKey('issues', fk);
        }
      }

      // Recreate users table
      await queryRunner.query(`
        CREATE TABLE users (
          discord_user_id BIGINT PRIMARY KEY,
          discord_username TEXT NOT NULL,
          display_name TEXT,
          created_at TIMESTAMP DEFAULT now(),
          updated_at TIMESTAMP DEFAULT now()
        )
      `);

      // Migrate data back
      await queryRunner.query(`
        INSERT INTO users (
          discord_user_id,
          discord_username,
          display_name,
          created_at,
          updated_at
        )
        SELECT 
          discord_id::bigint as discord_user_id,
          COALESCE(discord_username, '') as discord_username,
          discord_nickname as display_name,
          created_at,
          updated_at
        FROM players
        WHERE discord_id ~ '^[0-9]+$'
        ON CONFLICT (discord_user_id) DO NOTHING
      `);

      // Change column types back
      await queryRunner.query(`
        ALTER TABLE army_testers 
        ALTER COLUMN discord_user_id TYPE BIGINT USING discord_user_id::bigint
      `);

      await queryRunner.query(`
        ALTER TABLE weekly_cycles 
        ALTER COLUMN created_by TYPE BIGINT USING created_by::bigint
      `);

      await queryRunner.query(`
        ALTER TABLE submissions 
        ALTER COLUMN discord_user_id TYPE BIGINT USING discord_user_id::bigint
      `);

      await queryRunner.query(`
        ALTER TABLE submissions 
        ALTER COLUMN reviewed_by TYPE BIGINT USING reviewed_by::bigint
      `);

      await queryRunner.query(`
        ALTER TABLE issues 
        ALTER COLUMN reporter_user_id TYPE BIGINT USING reporter_user_id::bigint
      `);

      // Recreate foreign keys
      await queryRunner.createForeignKey(
        'army_testers',
        new TableForeignKey({
          columnNames: ['discord_user_id'],
          referencedTableName: 'users',
          referencedColumnNames: ['discord_user_id'],
          onDelete: 'CASCADE',
        })
      );

      await queryRunner.createForeignKey(
        'weekly_cycles',
        new TableForeignKey({
          columnNames: ['created_by'],
          referencedTableName: 'users',
          referencedColumnNames: ['discord_user_id'],
          onDelete: 'SET NULL',
        })
      );

      await queryRunner.createForeignKey(
        'submissions',
        new TableForeignKey({
          columnNames: ['discord_user_id'],
          referencedTableName: 'users',
          referencedColumnNames: ['discord_user_id'],
          onDelete: 'CASCADE',
        })
      );

      await queryRunner.createForeignKey(
        'submissions',
        new TableForeignKey({
          columnNames: ['reviewed_by'],
          referencedTableName: 'users',
          referencedColumnNames: ['discord_user_id'],
          onDelete: 'SET NULL',
        })
      );

      await queryRunner.createForeignKey(
        'issues',
        new TableForeignKey({
          columnNames: ['reporter_user_id'],
          referencedTableName: 'users',
          referencedColumnNames: ['discord_user_id'],
          onDelete: 'CASCADE',
        })
      );

      // Drop players table
      await queryRunner.dropTable('players', true);
    }
  }
}
