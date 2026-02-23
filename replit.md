# Tester Army Discord Bot

## Overview
A NestJS Discord bot for managing a Tester Army program. Players submit test reports, earn TC (Test Currency/Gems), and climb ranks (Recruit -> Explorer -> Test Pilot -> Founders Circle).

## Architecture
- **Framework**: NestJS with TypeScript
- **Database**: PostgreSQL via TypeORM
- **Bot**: Discord.js slash commands
- **External**: Google Sheets integration for form submissions

## Key Modules
- `src/discord/commands/` - Slash commands (profile, leaderboard, participate, admin, reward)
- `src/submission/` - Submission management and TC calculations
- `src/tester-army/` - Tester membership and totals
- `src/rank/` - Rank evaluation based on TC thresholds
- `src/cycle/` - Weekly build cycles
- `src/google-sheets/` - Google Sheets form sync

## Recent Changes
- **2026-02-21**: Leaderboard updated to include ALL points (Confirmed + Pending + Declined) using `tc_proposed`. Points cannot decrease after admin review. Footer note added to leaderboard embed.

## User Preferences
- (none recorded yet)
