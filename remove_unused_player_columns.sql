-- Script to remove unused columns from players table
-- Run this in pgAdmin if migration fails or you prefer manual execution

-- Remove unused columns from players table
ALTER TABLE players 
DROP COLUMN IF EXISTS mwo_username,
DROP COLUMN IF EXISTS roles,
DROP COLUMN IF EXISTS player_level,
DROP COLUMN IF EXISTS board_value,
DROP COLUMN IF EXISTS server_join_date,
DROP COLUMN IF EXISTS account_creation_date,
DROP COLUMN IF EXISTS top_role;

-- Verify the table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'players'
ORDER BY ordinal_position;
