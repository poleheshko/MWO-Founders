-- Migration script to rename users table to players
-- Run this in pgAdmin Query Tool

BEGIN;

-- Step 1: Create players table with new structure
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
);

-- Step 2: Migrate data from users to players
-- Convert discord_user_id (bigint) to discord_id (text)
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
ON CONFLICT (discord_id) DO NOTHING;

-- Step 3: Drop foreign keys that reference users table
-- Drop FK from army_testers
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name LIKE '%discord_user_id%' 
    AND table_name = 'army_testers'
    AND constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE army_testers DROP CONSTRAINT IF EXISTS army_testers_discord_user_id_fkey;
  END IF;
END $$;

-- Drop FK from weekly_cycles
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name LIKE '%created_by%' 
    AND table_name = 'weekly_cycles'
    AND constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE weekly_cycles DROP CONSTRAINT IF EXISTS weekly_cycles_created_by_fkey;
  END IF;
END $$;

-- Drop FKs from submissions
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name LIKE '%discord_user_id%' 
    AND table_name = 'submissions'
    AND constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE submissions DROP CONSTRAINT IF EXISTS submissions_discord_user_id_fkey;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name LIKE '%reviewed_by%' 
    AND table_name = 'submissions'
    AND constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE submissions DROP CONSTRAINT IF EXISTS submissions_reviewed_by_fkey;
  END IF;
END $$;

-- Drop FK from issues
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name LIKE '%reporter_user_id%' 
    AND table_name = 'issues'
    AND constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE issues DROP CONSTRAINT IF EXISTS issues_reporter_user_id_fkey;
  END IF;
END $$;

-- Step 4: Update column types in related tables
-- Change discord_user_id from bigint to text in army_testers
ALTER TABLE army_testers 
ALTER COLUMN discord_user_id TYPE TEXT USING discord_user_id::text;

-- Change created_by from bigint to text in weekly_cycles
ALTER TABLE weekly_cycles 
ALTER COLUMN created_by TYPE TEXT USING created_by::text;

-- Change discord_user_id from bigint to text in submissions
ALTER TABLE submissions 
ALTER COLUMN discord_user_id TYPE TEXT USING discord_user_id::text;

-- Change reviewed_by from bigint to text in submissions
ALTER TABLE submissions 
ALTER COLUMN reviewed_by TYPE TEXT USING reviewed_by::text;

-- Change reporter_user_id from bigint to text in issues
ALTER TABLE issues 
ALTER COLUMN reporter_user_id TYPE TEXT USING reporter_user_id::text;

-- Step 5: Recreate foreign keys pointing to players table
ALTER TABLE army_testers 
ADD CONSTRAINT army_testers_discord_user_id_fkey 
FOREIGN KEY (discord_user_id) REFERENCES players(discord_id) ON DELETE CASCADE;

ALTER TABLE weekly_cycles 
ADD CONSTRAINT weekly_cycles_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES players(discord_id) ON DELETE SET NULL;

ALTER TABLE submissions 
ADD CONSTRAINT submissions_discord_user_id_fkey 
FOREIGN KEY (discord_user_id) REFERENCES players(discord_id) ON DELETE CASCADE;

ALTER TABLE submissions 
ADD CONSTRAINT submissions_reviewed_by_fkey 
FOREIGN KEY (reviewed_by) REFERENCES players(discord_id) ON DELETE SET NULL;

ALTER TABLE issues 
ADD CONSTRAINT issues_reporter_user_id_fkey 
FOREIGN KEY (reporter_user_id) REFERENCES players(discord_id) ON DELETE CASCADE;

-- Step 6: Create index on players.discord_username
CREATE INDEX IF NOT EXISTS idx_players_username ON players(discord_username);

-- Step 7: Drop old users table
DROP TABLE IF EXISTS users CASCADE;

COMMIT;

-- Verify the migration
SELECT 'Migration completed! Players table created with ' || COUNT(*) || ' rows' as result FROM players;
