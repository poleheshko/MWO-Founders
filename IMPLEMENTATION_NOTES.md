# Implementation Notes

## Architecture Decisions

### Framework: NestJS + TypeScript
- **Why**: Provides excellent structure, dependency injection, and modularity
- **Benefits**: Type safety, easy testing, scalable architecture
- **Discord Library**: discord.js v14 (most mature and feature-rich)

### Database: PostgreSQL (SQLite for MVP)
- **Why**: PostgreSQL supports all required features (JSONB, UUID, etc.)
- **ORM**: TypeORM for type-safe database access
- **Migrations**: Alembic-style migrations via TypeORM

## Key Features Implemented

### ✅ Core Services
- **UserService**: Upserts Discord users automatically
- **TesterArmyService**: Manages program membership based on Discord roles
- **SubmissionService**: Handles all submission types with TC calculation
- **RankService**: Evaluates ranks and syncs Discord roles
- **CycleService**: Manages weekly testing cycles
- **GoogleSheetsService**: Polls Google Sheets for survey submissions

### ✅ Discord Commands

**Tester Commands:**
- `/profile` - View TC, rank, and recent submissions
- `/leaderboard [week|all]` - View leaderboards
- `/submit screenshot` - Submit screenshot with insight
- `/submit bug` - Submit bug report (with optional video)
- `/submit balance` - Submit balance analysis
- `/submit retest` - Submit re-test confirmation

**Admin Commands:**
- `/cycle create` - Create weekly cycle
- `/cycle publish` - Publish cycle
- `/submission review` - Approve/decline submissions
- `/shipped` - Award shipped bonus (+100 TC)
- `/tc adjust` - Manually adjust TC
- `/report weekly` - Generate weekly report

### ✅ Automated Workflows
- **Membership Sync**: On member join/update, nightly sync
- **Rank Evaluation**: Automatic after TC recalculation
- **Google Sheets Polling**: Every 5 minutes
- **Reminders**: Wednesday (mid-week), Friday (deadline)
- **Weekly Reports**: Sunday (with cycle closure)

## Database Schema

All tables match the spec exactly:
- `users` - Global user identity
- `army_testers` - Program membership + cached TC
- `weekly_cycles` - Weekly mission packs
- `submissions` - All tester contributions
- `issues` - Optional bug tracking

## TC Scoring

Implemented as configurable constants:
- Quick Test: 10 TC
- Survey: 3 TC (auto-approved)
- Screenshot: 5 TC
- Bug Repro: 25 TC
- Bug Video: 40 TC
- Balance Analysis: 30 TC
- Re-test: 15 TC
- Shipped Bonus: 100 TC

## Rank System

Ranks are evaluated automatically:
1. **Recruit** (default)
2. **Explorer**: 60+ confirmed TC
3. **Test Pilot**: 250+ TC + 2 structured reports
4. **Founders Circle**: 900+ TC OR top 15 all-time

Discord roles are automatically synced when ranks change.

## Migration from Python Bot

The bot maintains compatibility:
- `users` table stores Discord username and user ID (same as your `players` table)
- You can migrate existing data by copying from `players` to `users`
- The bot will automatically sync membership based on Discord roles

## Important Notes

### Rate Limiting
- Submissions are rate-limited (default: 10/hour per user)
- Configurable via `RATE_LIMIT_SUBMIT_PER_HOUR`

### Deduplication
- Survey submissions: Max 1 per cycle per user (handled in Google Sheets service)
- Quick Tests: Policy decision (can be enforced per cycle)

### Safety Features
- All submissions are auditable (never deleted)
- TC totals are recalculated after every review
- Rank evaluation happens automatically
- Membership sync runs nightly as safety net

### Google Sheets Integration
- Polls every 5 minutes for new survey submissions
- Requires Google Service Account with Sheets API access
- Auto-approves survey submissions (3 TC)
- Stores Google response metadata in payload

## Configuration

All settings are in `.env`:
- Discord bot token and guild ID
- Database connection
- Channel IDs for announcements
- TC scoring constants
- Rank thresholds
- Google Sheets credentials

## Development vs Production

**Development:**
- `synchronize: true` - Auto-creates tables
- Detailed logging enabled
- Hot reload with `npm run start:dev`

**Production:**
- Use migrations: `npm run migration:run`
- Set `synchronize: false`
- Use `npm run build && npm run start:prod`

## Testing Checklist

Before going live:
- [ ] Bot connects to Discord
- [ ] Commands register successfully
- [ ] Database connection works
- [ ] User upsert works
- [ ] Membership sync works (assign Tester Recruit role)
- [ ] Submissions create correctly
- [ ] TC totals calculate correctly
- [ ] Rank evaluation works
- [ ] Leaderboard displays correctly
- [ ] Admin commands work
- [ ] Google Sheets polling works (if enabled)
- [ ] Scheduled tasks run correctly

## Known Limitations / Future Enhancements

1. **Attachments in Slash Commands**: Discord.js doesn't directly support attachments in slash commands. Consider:
   - Using message commands for file uploads
   - Having users upload to a channel first, then reference the message
   - Using Discord's attachment URLs from message interactions

2. **Issue Tracking**: The `issues` table is created but not fully integrated. You can extend the bot to:
   - Auto-create issues from bug submissions
   - Link issues to submissions
   - Add issue management commands

3. **Advanced Mission JSON**: Structure not fully defined. Extend `CycleService.setMissions()` to handle your specific mission format.

4. **Leaderboard Top N Check**: Founders Circle rank check for "top 15" is simplified. In production, you'd want to:
   - Query the all-time leaderboard
   - Check if user is in top N
   - Update rank accordingly

5. **Survey Deduplication**: Currently handled at ingestion level. Consider adding:
   - Database-level uniqueness constraints
   - Better error handling for duplicates

## Support

For issues:
1. Check logs for error messages
2. Verify environment variables are set correctly
3. Ensure database is accessible
4. Check Discord bot permissions and intents

## License

MIT - Feel free to modify and extend as needed!
