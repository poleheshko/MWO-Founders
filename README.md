# Monopoly World – Tester Army Bot

A comprehensive Discord bot built with NestJS and TypeScript for managing a structured community QA program with weekly cycles, test credits (TC), ranks, leaderboards, and automated workflows.

## Features

- ✅ **User Management**: Automatic user upsert and tracking
- ✅ **Program Membership**: Role-driven membership sync for Tester Army
- ✅ **Weekly Cycles**: Create and manage weekly testing cycles with missions
- ✅ **Submissions**: Multiple submission types (screenshots, bugs, balance analysis, etc.)
- ✅ **Test Credits (TC)**: Scoring system with pending/confirmed TC states
- ✅ **Rank System**: Automatic rank evaluation and Discord role management
- ✅ **Leaderboards**: Weekly and all-time leaderboards
- ✅ **Google Sheets Integration**: Auto-ingest survey submissions
- ✅ **Scheduled Tasks**: Automated reminders and reports
- ✅ **Admin Tools**: Review submissions, adjust TC, generate reports

## Tech Stack

- **Framework**: NestJS (Node.js/TypeScript)
- **Discord Library**: discord.js v14
- **Database**: PostgreSQL (SQLite supported for MVP)
- **ORM**: TypeORM
- **Scheduling**: @nestjs/schedule
- **Google APIs**: googleapis

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL database (or SQLite for MVP)
- Discord Bot Token
- Google Service Account (for survey ingestion, optional)

## Installation

1. **Clone and install dependencies:**

```bash
npm install
```

2. **Set up environment variables:**

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required variables:
- `DISCORD_BOT_TOKEN`: Your Discord bot token
- `DISCORD_GUILD_ID`: Your Discord server ID
- `DATABASE_URL`: PostgreSQL connection string (or use SQLite)

3. **Set up the database:**

The bot will auto-create tables in development mode. For production, use migrations:

```bash
npm run migration:generate -- -n InitialMigration
npm run migration:run
```

4. **Build and run:**

```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod
```

## Configuration

### Discord Setup

1. Create a Discord application at https://discord.com/developers/applications
2. Create a bot and copy the token
3. Enable these intents in the Discord Developer Portal:
   - Server Members Intent
   - Message Content Intent
4. Invite the bot to your server with appropriate permissions

### Database Setup

**PostgreSQL (Recommended):**
```env
DATABASE_URL=postgresql://user:password@localhost:5432/monopoly_world
```

**SQLite (MVP):**
```env
DATABASE_TYPE=sqlite
DATABASE_PATH=./data/database.sqlite
```

### Google Sheets Setup (Optional)

1. Create a Google Cloud Project
2. Enable Google Sheets API
3. Create a Service Account and download the JSON key
4. Share your Google Sheet with the service account email
5. Set environment variables:
```env
GOOGLE_SHEETS_SPREADSHEET_ID=your_sheet_id
GOOGLE_SERVICE_ACCOUNT_KEY=path/to/service-account-key.json
```

## Commands

### Tester Commands

- `/profile` - View your Tester Army profile (TC, rank, submissions)
- `/leaderboard [scope]` - View weekly or all-time leaderboard
- `/submit screenshot <text>` - Submit a screenshot with insight
- `/submit bug <title> <repro_steps> [video_or_link]` - Submit a bug report
- `/submit balance <text>` - Submit balance analysis
- `/submit retest <issue_id> <result>` - Submit re-test confirmation

### Admin Commands

- `/cycle create <build_version> <build_link> <week_start>` - Create a weekly cycle
- `/cycle publish <cycle_id>` - Publish a cycle
- `/submission review <submission_id> approve|decline [comments]` - Review submissions
- `/shipped <submission_id> <public_message>` - Award shipped bonus (+100 TC)
- `/tc adjust <user> <delta> <reason>` - Manually adjust TC
- `/report weekly <cycle_id>` - Generate weekly report

## Database Schema

The bot uses the following main tables:

- `users` - All Discord users
- `army_testers` - Tester Army members with TC totals
- `weekly_cycles` - Weekly testing cycles
- `submissions` - All tester submissions
- `issues` - Bug tracking (optional)

See the spec document for detailed schema.

## Program Roles

The bot recognizes these Discord roles for membership:

- `Tester Recruit` (default rank)
- `Explorer` (60+ confirmed TC)
- `Test Pilot` (250+ TC + 2 structured reports)
- `Founders Circle` (900+ TC OR top 15 all-time)

## TC Scoring

- Quick Test: 10 TC
- Survey: 3 TC (auto-approved)
- Screenshot Insight: 5 TC
- Bug w/ Repro: 25 TC
- Bug w/ Video: 40 TC
- Balance Analysis: 30 TC
- Re-test Confirmation: 15 TC
- Shipped Feature: 100 TC

## Scheduled Tasks

- **Every 5 minutes**: Poll Google Sheets for new survey submissions
- **Wednesday 12:00**: Mid-week reminder
- **Friday 18:00**: Deadline reminder
- **Sunday 12:00**: Weekly report and cycle closure
- **Daily 02:00**: Nightly membership sync

## Migration from Python Bot

The bot maintains compatibility with your existing user collection:

1. The `users` table stores Discord username and user ID
2. Existing data can be migrated by running a script to populate `users` from your `players` table
3. The bot will automatically sync membership based on Discord roles

## Development

```bash
# Watch mode
npm run start:dev

# Build
npm run build

# Lint
npm run lint

# Format
npm run format
```

## Project Structure

```
src/
├── config/          # Configuration files
├── database/        # Database entities and module
├── discord/         # Discord bot service and commands
├── user/            # User service
├── tester-army/    # Tester Army membership service
├── submission/      # Submission service
├── cycle/           # Weekly cycle service
├── rank/            # Rank evaluation service
├── google-sheets/   # Google Sheets integration
├── scheduler/       # Scheduled tasks
└── main.ts          # Application entry point
```

## Troubleshooting

**Bot not responding:**
- Check that `DISCORD_BOT_TOKEN` is correct
- Verify bot has proper permissions in your server
- Check bot intents are enabled in Discord Developer Portal

**Commands not appearing:**
- Commands sync on bot startup (may take up to 1 hour for global commands)
- Use guild-specific commands for faster development

**Database errors:**
- Verify `DATABASE_URL` is correct
- Check database exists and is accessible
- Ensure tables are created (use migrations or set `synchronize: true` in dev)

## License

MIT

## Support

For issues or questions, check the codebase or create an issue in your repository.
