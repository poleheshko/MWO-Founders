# Quick Start Guide

## 1. Install Dependencies

```bash
npm install
```

## 2. Set Up Environment

Copy `.env.example` to `.env` and fill in:

```bash
cp .env.example .env
```

**Minimum required:**
- `DISCORD_BOT_TOKEN` - Get from https://discord.com/developers/applications
- `DISCORD_GUILD_ID` - Your Discord server ID
- `DATABASE_URL` - PostgreSQL connection string

## 3. Database Setup

### Option A: PostgreSQL (Recommended)

```bash
# Create database
createdb monopoly_world

# Set DATABASE_URL in .env
DATABASE_URL=postgresql://user:password@localhost:5432/monopoly_world
```

### Option B: SQLite (Quick MVP)

```bash
# Set in .env
DATABASE_TYPE=sqlite
DATABASE_PATH=./data/database.sqlite

# Create data directory
mkdir -p data
```

## 4. Run Migrations (Production)

```bash
npm run migration:run
```

**Note:** In development, TypeORM will auto-create tables if `synchronize: true` is set.

## 5. Start the Bot

```bash
# Development (with hot reload)
npm run start:dev

# Production
npm run build
npm run start:prod
```

## 6. Verify Bot is Running

You should see:
```
✅ NestJS application is running on port 3000
✅ Discord bot logged in
✅ Bot ready: YourBot#1234
Started refreshing application (/) commands.
Successfully registered X guild commands.
```

## 7. Test Commands

In your Discord server, try:
- `/profile` - Should show your profile (if you have a Tester Army role)
- `/leaderboard` - Should show the leaderboard

## 8. Set Up Program Roles

Create these roles in Discord (exact names):
- `Tester Recruit`
- `Explorer`
- `Test Pilot`
- `Founders Circle`

Assign `Tester Recruit` to testers to activate membership sync.

## 9. Configure Channels (Optional)

Set these in `.env` for automated announcements:
- `CHANNEL_ANNOUNCEMENTS` - For cycle announcements and reminders
- `CHANNEL_HIGHLIGHTS` - For shipped feature highlights
- `CHANNEL_ADMIN_LOGS` - For admin activity logs

## 10. Google Sheets Setup (Optional)

If you want survey auto-ingestion:

1. Create Google Cloud Project
2. Enable Google Sheets API
3. Create Service Account, download JSON key
4. Share your Google Sheet with service account email
5. Set in `.env`:
   ```
   GOOGLE_SHEETS_SPREADSHEET_ID=your_sheet_id
   GOOGLE_SERVICE_ACCOUNT_KEY=path/to/key.json
   ```

## Troubleshooting

**Bot doesn't respond:**
- Check bot token is correct
- Verify bot is in your server
- Check bot has "Message Content" intent enabled

**Commands don't appear:**
- Wait up to 1 hour for global commands
- Use guild-specific commands (set `DISCORD_GUILD_ID`) for instant sync

**Database errors:**
- Verify connection string is correct
- Check database exists
- Ensure tables are created (run migrations or use synchronize in dev)

**Membership not syncing:**
- Verify role names match exactly (case-sensitive)
- Check bot has "Server Members" intent
- Run `/refreshdatabase` (if you port that command) or wait for nightly sync

## Next Steps

1. Create your first weekly cycle: `/cycle create`
2. Publish it: `/cycle publish`
3. Test submissions: `/submit screenshot`
4. Review submissions: `/submission review`
