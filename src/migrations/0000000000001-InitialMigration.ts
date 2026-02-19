import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class InitialMigration0000000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Players table
    await queryRunner.createTable(
      new Table({
        name: 'players',
        columns: [
          {
            name: 'discord_id',
            type: 'text',
            isPrimary: true,
          },
          {
            name: 'discord_username',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'discord_nickname',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'player_id',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'mwo_username',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'roles',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'player_level',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'board_value',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'server_join_date',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'account_creation_date',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'top_role',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
      true,
    );

    // Create index only if it doesn't exist
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_players_username ON players(discord_username)
    `);

    // Army Testers table
    await queryRunner.createTable(
      new Table({
        name: 'army_testers',
        columns: [
          {
            name: 'discord_user_id',
            type: 'text',
            isPrimary: true,
          },
          {
            name: 'status',
            type: 'text',
            default: "'active'",
          },
          {
            name: 'joined_at',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'left_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'current_rank',
            type: 'text',
            default: "'recruit'",
          },
          {
            name: 'tc_confirmed_total',
            type: 'int',
            default: 0,
          },
          {
            name: 'tc_pending_total',
            type: 'int',
            default: 0,
          },
          {
            name: 'structured_reports_confirmed',
            type: 'int',
            default: 0,
          },
          {
            name: 'last_activity_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'metadata_json',
            type: 'jsonb',
            isNullable: true,
          },
        ],
        foreignKeys: [
          {
            columnNames: ['discord_user_id'],
            referencedTableName: 'players',
            referencedColumnNames: ['discord_id'],
          },
        ],
      }),
      true,
    );

    // Create indexes only if they don't exist
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_army_testers_rank ON army_testers(current_rank)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_army_testers_status ON army_testers(status)
    `);

    // Weekly Cycles table
    await queryRunner.createTable(
      new Table({
        name: 'weekly_cycles',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'week_start',
            type: 'date',
            isNullable: false,
          },
          {
            name: 'week_end',
            type: 'date',
            isNullable: false,
          },
          {
            name: 'build_version',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'build_link',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'quick_missions_json',
            type: 'jsonb',
            default: "'[]'",
          },
          {
            name: 'advanced_mission_json',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'text',
            default: "'draft'",
          },
          {
            name: 'created_by',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'now()',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['created_by'],
            referencedTableName: 'players',
            referencedColumnNames: ['discord_id'],
          },
        ],
      }),
      true,
    );

    // Create index only if it doesn't exist
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_weekly_cycles_week_start ON weekly_cycles(week_start)
    `);

    // Submissions table
    await queryRunner.createTable(
      new Table({
        name: 'submissions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'discord_user_id',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'cycle_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'type',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'payload_json',
            type: 'jsonb',
            default: "'{}'",
          },
          {
            name: 'evidence_urls',
            type: 'jsonb',
            default: "'[]'",
          },
          {
            name: 'status',
            type: 'text',
            default: "'pending'",
          },
          {
            name: 'tc_proposed',
            type: 'int',
            default: 0,
          },
          {
            name: 'tc_awarded',
            type: 'int',
            default: 0,
          },
          {
            name: 'reviewed_by',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'review_comment_private',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'review_comment_public',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'reviewed_at',
            type: 'timestamp',
            isNullable: true,
          },
        ],
        foreignKeys: [
          {
            columnNames: ['discord_user_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['discord_user_id'],
          },
          {
            columnNames: ['cycle_id'],
            referencedTableName: 'weekly_cycles',
            referencedColumnNames: ['id'],
          },
          {
            columnNames: ['reviewed_by'],
            referencedTableName: 'users',
            referencedColumnNames: ['discord_user_id'],
          },
        ],
      }),
      true,
    );

    // Create indexes only if they don't exist
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_submissions_user ON submissions(discord_user_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_submissions_cycle ON submissions(cycle_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_submissions_type ON submissions(type)
    `);

    // Issues table
    await queryRunner.createTable(
      new Table({
        name: 'issues',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'cycle_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'reporter_user_id',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'linked_submission_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'title',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'repro_steps',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'severity',
            type: 'text',
            default: "'medium'",
          },
          {
            name: 'evidence_urls',
            type: 'jsonb',
            default: "'[]'",
          },
          {
            name: 'status',
            type: 'text',
            default: "'new'",
          },
          {
            name: 'qa_comment_private',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'qa_comment_public',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'now()',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['cycle_id'],
            referencedTableName: 'weekly_cycles',
            referencedColumnNames: ['id'],
          },
          {
            columnNames: ['reporter_user_id'],
            referencedTableName: 'players',
            referencedColumnNames: ['discord_id'],
          },
          {
            columnNames: ['linked_submission_id'],
            referencedTableName: 'submissions',
            referencedColumnNames: ['id'],
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('issues', true);
    await queryRunner.dropTable('submissions', true);
    await queryRunner.dropTable('weekly_cycles', true);
    await queryRunner.dropTable('army_testers', true);
    await queryRunner.dropTable('players', true);
  }
}
