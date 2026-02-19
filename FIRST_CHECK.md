# First Check Run Instructions

Follow these steps to verify your setup before running the bot:

## Step 1: Verify Dependencies are Installed

```powershell
# Check if node_modules exists
Test-Path node_modules

# If it doesn't exist or is empty, install dependencies:
npm install

# IMPORTANT: Ensure @nestjs/config is installed (required dependency)
npm install @nestjs/config
```

**Expected:** Should see `node_modules` folder with packages installed.

**Note:** If you see TypeScript errors about `@nestjs/config` not being found, run `npm install @nestjs/config` to add the missing dependency.

---

## Step 2: Verify Environment Configuration

Your `.env` file should have these **minimum required** variables set:

✅ **Discord Bot Token** - `DISCORD_BOT_TOKEN`
✅ **Discord Guild ID** - `DISCORD_GUILD_ID`  
✅ **Database URL** - `DATABASE_URL` (PostgreSQL connection string)

**Check your .env file:**
```powershell
# View .env (be careful not to expose tokens publicly)
Get-Content .env
```

**Current Status:**
- ✅ DISCORD_BOT_TOKEN: Set
- ✅ DISCORD_GUILD_ID: Set (1309508298814259382)
- ✅ DATABASE_URL: Set (Neon PostgreSQL)
- ✅ Channel IDs: All configured
- ✅ Google Sheets: Configured

---

## Step 3: Verify Database Connection

Test if your PostgreSQL database is accessible:

```powershell
# Option 1: Test connection via Node.js (if you have a test script)
# Or manually verify the connection string format is correct

# Your current DATABASE_URL:
# postgresql://neondb_owner:npg_oyYc6HaeqN7Q@ep-damp-star-ab39jn1x-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

**Note:** In development mode, TypeORM will auto-create tables if `synchronize: true` is set in the database config.

---

## Step 4: Verify Google Service Account Key

Check if the service account JSON file exists:

```powershell
Test-Path "credentials\mwo-founders-02a1503a4bee.json"
```

**Expected:** Should return `True` if file exists.

---

## Step 5: Build the Project (Optional but Recommended)

```powershell
npm run build
```

**Expected:** Should compile TypeScript without errors.

**If you see errors:**
- Check TypeScript version compatibility
- Verify all imports are correct
- Check for missing dependencies

---

## Step 6: Run Database Migrations (If Needed)

For production or if you want to use migrations:

```powershell
npm run migration:run
```

**Note:** In development, TypeORM auto-syncs tables, so migrations may not be necessary.

---

## Step 7: Start the Bot in Development Mode

```powershell
npm run start:dev
```

**Expected Output:**
```
✅ NestJS application is running on port 3000
✅ Discord bot logged in
✅ Bot ready: YourBot#1234
Started refreshing application (/) commands.
Successfully registered X guild commands.
```

**What to Watch For:**
- ✅ No database connection errors
- ✅ Discord bot successfully logs in
- ✅ Commands register successfully
- ✅ No TypeScript compilation errors
- ✅ No missing environment variable warnings

---

## Step 8: Test Basic Functionality

Once the bot is running, test in your Discord server:

1. **Check Bot Status:**
   - Bot should appear online in your Discord server
   - Bot should have proper permissions

2. **Test Commands:**
   - `/profile` - Should show your profile (if you have a Tester Army role)
   - `/leaderboard` - Should show the leaderboard

3. **Verify Roles:**
   - Ensure these roles exist in Discord (exact names):
     - `Tester Recruit`
     - `Explorer`
     - `Test Pilot`
     - `Founders Circle`

---

## Troubleshooting Common Issues

### ❌ "Cannot find module" errors
**Solution:** Run `npm install` again

### ❌ Database connection failed
**Solution:** 
- Verify DATABASE_URL is correct
- Check if database server is accessible
- Verify credentials are correct

### ❌ Discord bot doesn't log in
**Solution:**
- Verify DISCORD_BOT_TOKEN is correct
- Check bot is invited to server with proper permissions
- Ensure "Message Content" intent is enabled in Discord Developer Portal

### ❌ Commands don't appear
**Solution:**
- Wait up to 1 hour for global commands
- Use guild-specific commands (DISCORD_GUILD_ID is set) for instant sync
- Check bot has "applications.commands" scope

### ❌ Google Sheets errors
**Solution:**
- Verify service account JSON file exists
- Check file path in .env matches actual location
- Ensure Google Sheet is shared with service account email

---

## Quick Verification Checklist

Before running, verify:

- [ ] `node_modules` folder exists
- [ ] `.env` file has all required variables
- [ ] Database connection string is valid
- [ ] Google service account JSON file exists
- [ ] Discord bot token is valid
- [ ] Bot is invited to Discord server
- [ ] Required Discord roles exist
- [ ] Project builds without errors (`npm run build`)

---

## Next Steps After First Check

Once everything passes:

1. ✅ Bot is running successfully
2. ✅ Test commands work
3. ✅ Database is connected
4. ✅ Ready for production deployment

You can then:
- Create your first weekly cycle: `/cycle create`
- Publish it: `/cycle publish`
- Test submissions: `/submit screenshot`
- Review submissions: `/submission review`
