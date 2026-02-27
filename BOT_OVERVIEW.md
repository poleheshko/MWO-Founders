### Bot Architecture & Mechanics – Overview

This document explains how the Monopoly World “Founders / Tester Army” Discord bot works, so other AIs (like ChatGPT) or developers can safely modify or extend it.

---

## 1. Purpose & High‑Level Flow

**Goal:**  
The bot runs the Monopoly World “Tester Army / Founders Circle” program on Discord. It:

- **Links Discord users to emails** used in Google Forms.
- **Ingests feedback from Google Sheets** (bug reports, balance analyses, structured reports, “Record your session”, etc.).
- **Calculates and tracks “gems” (TC points)** per user and per weekly build.
- **Maintains ranks & Discord roles** based on total gems.
- **Provides slash commands** for testers (`/founders`, `/leaderboard`, `/participate`, `/reward`) and admins (`/build`, `/award`, `/tc`, `/rank`, `/report`, `/player-id`, `/sheets`).
- **Posts highlight messages** to Discord channels when important actions happen (new feedback, awarded bonuses, shipped features, etc.).

Runtime stack:

- NestJS backend (`main.ts`, `AppModule`).
- Discord.js for Discord client & slash commands.
- TypeORM database with entities like `Player`, `Submission`, `TesterArmy`, `WeeklyCycle`, etc.
- Google Sheets API via `GoogleSheetsService` for ingestion.
- Nest scheduler & custom `SchedulerService` for periodic syncs.

---

## 2. Runtime Architecture

- **Entry point**: `src/main.ts`
  - Loads `.env` explicitly *before* any other imports (so `.env` always wins).
  - Clears default `PG*` env vars and lets Nest/config drive DB config.
  - Boots `AppModule` (`NestFactory.create(AppModule)`).
  - Sets up global error handlers and graceful shutdown for `SIGINT` / `SIGTERM`.

- **Main module**: `src/app.module.ts`
  - Imports:
    - `ConfigModule.forRoot` (env + `src/config/config.ts`)
    - `ScheduleModule.forRoot`
    - `DatabaseModule`
    - `DiscordModule`
    - `PlayerModule`
    - `TesterArmyModule`
    - `SubmissionModule`
    - `CycleModule`
    - `GoogleSheetsModule`
    - `SchedulerModule`
  - Exposes `HealthController` for uptime/health checks.

**Key domains:**

- `DiscordService` – owns the `discord.js` `Client`, handles member join/update, DMs, highlight messages, and utility methods like `getGemEmoji`.
- `DiscordCommandService` – registers slash commands with Discord and routes `interactionCreate` events to the specific command classes.
- Command classes:
  - `ProfileCommand` – `/founders profile` & `/founders add-email`.
  - `ParticipateCommand` – `/participate`.
  - `LeaderboardCommand` – `/leaderboard`.
  - `RewardCommand` – `/reward`.
  - `AdminCommands` – all admin slash commands.
- `GoogleSheetsService` – reads from various Google Sheets, converts rows → submissions, updates points, and sends notifications.

---

## 3. Discord Integration

### 3.1 Discord client lifecycle (`DiscordService`)

**File:** `src/discord/discord.service.ts`  
**Implements:** `OnModuleInit`, `OnModuleDestroy`.

On startup:

1. Reads `discord.token` and `discord.guildId` from config.
2. Creates a `Client` with intents:
   - `Guilds`, `GuildMembers`, `GuildMessages`, `MessageContent`.
3. Configures REST retries and timeouts.
4. Logs in the bot and sets up event handlers:
   - `ready` – logs bot tag, calls `registerCommands()` (actual registration is done in `DiscordCommandService`).
   - `guildMemberAdd` – calls `handleMemberJoin`.
   - `guildMemberUpdate` – calls `handleMemberUpdate`.
   - `disconnect`, `reconnecting`, `error`, `warn`, `shardError` – logs and relies on Discord.js auto‑reconnect.

On shutdown:

- `onModuleDestroy()` → `client.destroy()`.

### 3.2 Member join/update mechanics

**`handleMemberJoin(member: GuildMember)`**

- Skips bots.
- Calls `playerService.updateTempDiscordId(member.id)` to link any temporary players (created from forms) to this real Discord ID.
- Ensures a `Player` row via:
  - `playerService.getPlayerOrCreate(member.id, member.user.username, member.displayName)`.
- Reads role names and syncs Tester Army membership:
  - `testerArmyService.syncMembership(member.id, username, displayName, roles)`.
- If tester exists:
  - `rankService.evaluateRank(member.id)`.
  - `rankService.syncDiscordRoles(member.id, guild)`.

**`handleMemberUpdate(member: GuildMember)`**

- Skips bots.
- Uses `playerService.upsertPlayer` to keep username/nickname up‑to‑date.
- Syncs membership and re‑evaluates rank (same flow as join).

### 3.3 Command registration & routing (`DiscordCommandService`)

**File:** `src/discord/discord-command.service.ts`

**On module init:**

- Waits ~2 seconds, then:
  - Gets the `Client` from `DiscordService`.
  - If already ready → registers commands and sets up handlers.
  - Else → waits for `client.once('ready')` and then does the same.

**Command registration:**

- Collects command definitions:
  - `ProfileCommand.data` (`/founders` with `profile` and `add-email`).
  - `LeaderboardCommand.data` (`/leaderboard`).
  - `RewardCommand.data` (`/reward`).
  - `ParticipateCommand.data` (`/participate`).
  - `AdminCommands` definitions:
    - `launchBuild` → `/build launch`.
    - `awardDeliveredFeatures` → `/award delivered`.
    - `shipped` → `/shipped`.
    - `tcAdjust` → `/tc adjust`.
    - `report` → `/report weekly`.
    - `rankSync` → `/rank sync`.
    - `addPlayerId` → `/player-id set` + `/player-id add`.
    - `sheetsSync` → `/sheets sync` + `/sheets sync-individual`.
- Serializes them with `.toJSON()`.
- Uses `REST` (`discord.js`) with `Routes.applicationCommands` and `Routes.applicationGuildCommands`:
  - If `discord.guildId` is set:
    - Clears **global** commands (no duplicates).
    - Registers **guild‑only** commands for that guild (fast propagation).
  - Otherwise:
    - Registers **global** commands (slower propagation but work on all servers).

**Interaction routing (`setupInteractionHandlers`)**:

- Listens on `client.on('interactionCreate', ...)`.
- Buttons:
  - If `interaction.isButton()` and `customId === 'structured_report_select_build'`:
    - Delegates to `ParticipateCommand.handleStructuredReportBuildSelection`.
- Slash commands (only `isChatInputCommand`):
  - Routes by `commandName` and subcommand:
    - `/founders profile` or `/founders add-email` → `ProfileCommand.execute`.
    - `/leaderboard` → `LeaderboardCommand.execute`.
    - `/reward` → `RewardCommand.execute`.
    - `/participate` → `ParticipateCommand.execute`.
    - `/build launch` → `AdminCommands.handleLaunchBuild`.
    - `/award delivered` → `AdminCommands.handleAwardDeliveredFeatures`.
    - `/shipped` → `AdminCommands.handleShipped`.
    - `/tc adjust` → `AdminCommands.handleTcAdjust`.
    - `/report weekly` → `AdminCommands.handleReportWeekly`.
    - `/rank sync` → `AdminCommands.handleRankSync`.
    - `/player-id set` → `AdminCommands.handleSetPlayerId`.
    - `/player-id add` → `AdminCommands.handleAddPlayerId`.
    - `/sheets sync` → `AdminCommands.handleSheetsSync`.
    - `/sheets sync-individual` → `AdminCommands.handleSheetsSyncIndividual`.

---

## 4. User Identity, Email Linking & Players

**Core idea:** Emails typed into Google Forms must be **linked** to Discord users so the bot can attribute submissions and gems correctly.

### 4.1 `/founders` – profile & email (`ProfileCommand`)

**File:** `src/discord/commands/profile.command.ts`

Subcommands:

- `/founders profile`
- `/founders add-email`

**`/founders add-email` flow:**

- Reads `email` argument and validates it.
- Calls:
  - `playerService.mergePlayerByEmail(discordUserId, email)`:
    - Merges any “temp” player that used this email in forms into the real Discord user.
    - If merged → `submissionService.recalculateTotals(discordUserId)` to recompute gems.
- Ensures `Player` exists (creates if needed) and updates email:
  - `playerService.updatePlayerFields(discordUserId, undefined, email)`.

**`/founders profile` flow:**

1. Defers an **ephemeral** reply.
2. Gets Discord ID, username, and display name from the interaction.
3. Tries to load tester record:
   - `testerArmyService.getTester(discordUserId)`.
4. If not a tester yet:
   - Checks the member’s roles against `program.roles` from config.
   - If user has no program role:
     - Responds with a message + Google Form link to join Tester Army.
   - If user has program role:
     - Calls `testerArmyService.syncMembership(...)` to create/update tester record.
5. If tester exists:
   - Updates player record:
     - `playerService.upsertUser(discordUserId, username, displayName)`.
6. Ensures **email** is set:
   - If no valid email:
     - Tells user to use `/founders add-email` (email must match form submissions).
7. Rank evaluation:
   - `rankService.evaluateRank(discordUserId)`.
   - Refreshes tester record.
   - `rankService.syncDiscordRoles(discordUserId, guild)` to align Discord roles.
8. Loads submissions for this user (different subsets):
   - `getSubmissionsByUser(discordUserId, 5, 'pending')`.
   - `getSubmissionsByUser(discordUserId, 5, 'declined')`.
   - `getSubmissionsByUser(discordUserId, 15, 'approved')`.
   - Also loads all declined (up to a large limit) to compute total declined gems.
9. Maps internal submission types to user‑friendly names, with special handling for:
   - Structured report builds (per‑build forms): `Structured Report {buildVersion}`.
   - Record your session: `Record your session`.
10. Builds an embed with:
    - **Confirmed**, **Pending**, **Declined** gems (using tester totals and declined sums).
    - **Rank** (rank key mapped to friendly label).
    - **Email**.
    - Recent **pending**, **confirmed**, and **declined** submissions (with type, gems, date).

---

## 5. Commands & What They Do

### 5.1 `/participate` – submission links (`ParticipateCommand`)

**File:** `src/discord/commands/participate.command.ts`

Purpose: Show the user all active Google Form links and gem values in one embed + buttons.

Flow:

1. Defers **ephemeral** reply, logs for debugging.
2. Requires user to have a valid email in `Player`.
3. Ensures `FORM_*` variables are loaded:
   - Prefers `ConfigService.get('forms.*')`.
   - Falls back to `process.env.FORM_*`.
   - If no `FORM_*` keys in `process.env`, explicitly reads `.env` files (current dir, parent) and parses them.
4. Computes URLs for:
   - `forms.screenshot` / `FORM_SCREENSHOT` – **Bug with screenshot (5 gems)**.
   - `forms.bugRepro` / `FORM_BUG_REPRO` – **Bug with Reproduction Steps (25 gems)**.
   - `forms.bugVideo` / `FORM_BUG_VIDEO` – **Bug with Video (40 gems)**.
   - `forms.balanceAnalysis` / `FORM_BALANCE_ANALYSIS` – **Balance Analysis (30 gems)**.
   - `forms.retest` / `FORM_RETEST` – **Re‑test Confirmation (15 gems)**.
   - Rotating structured report link via `getStructuredReportLink` (see below).
   - `forms.recordSession` / `FORM_RECORD_SESSION` – **Record your session**.
5. For each link, uses `createButtonIfValid(label, url)`:
   - Rejects undefined/empty/`#` values.
   - Requires `http://` or `https://`.
   - Returns a `ButtonBuilder` with `ButtonStyle.Link` if valid.
6. Adds a **primary button** `Structured Report` with:
   - `setCustomId('structured_report_select_build')`.
   - This is handled via `DiscordCommandService` to display per‑build links.
7. Splits buttons into rows:
   - Row 1: first 5 buttons.
   - Row 2: remaining (up to 5).
8. Builds an embed that:
   - Explains each submission type and associated gems.
   - Mentions that links are updated automatically and that the structured report link changes every 8 weeks.
9. Sends reply via `interaction.editReply({ embeds, components })`.

**Structured report link rotation (`getStructuredReportLink`)**

- Reads:
  - `FORM_STRUCTURED_REPORT_LINKS` (env, comma‑separated URLs), or
  - `forms.structuredReportLinks` (config array).
- If none available:
  - Falls back to `FORM_STRUCTURED_REPORT` or `forms.structuredReport`.
- Computes week‑based index:
  - Calculates days since Jan 1 → `weekNumber = floor(days / 7)`.
  - `periodIndex = floor(weekNumber / 8) % structuredReportLinks.length`.
  - Returns the link for that period (same link for each 8‑week block).

**Per‑build structured report selection (`handleStructuredReportBuildSelection`)**

- Triggered by the `Structured Report` button.
- Requires user email (same rule as `/participate`).
- Fetches `forms.structuredReportBuilds` from config:
  - An array like `{ version: '2.10', formUrl: 'https://...' }`.
- Creates link buttons:
  - Labels `Build {version}`, URLs `formUrl`.
- Splits into up to 2 rows, attaches to reply with an embed prompting the user to select a build.

### 5.2 `/reward` – reward explanation (`RewardCommand`)

**File:** `src/discord/commands/reward.command.ts`

Purpose: Show a static explanation of all program rewards so testers understand incentives.

Flow:

1. Defers non‑ephemeral reply.
2. Requires that the user has a valid email.
3. Uses `DiscordService.getGemEmoji()` to show the gem emoji consistently.
4. Builds an embed describing:
   - **Testing benefits** (weekly participation, first experience video, deep analysis packages).
   - **Weekly game winners** (1st–20th place rewards in gems).
5. Sends the embed.

No dynamic calculations here: all values are static text, but they rely on the gem emoji helper.

### 5.3 `/leaderboard` – standings (`LeaderboardCommand`)

**File:** `src/discord/commands/leaderboard.command.ts`

Command: `/leaderboard [scope]`

- `scope`: optional, choices `week` or `all` (default `all`).

Flow:

1. Defers non‑ephemeral reply.
2. Requires a valid email.
3. Reads `scope`:
   - If `week`:
     - Calls `cycleService.getActiveCycle()`.
     - If no active cycle → informs the user.
     - Else uses the active cycle’s `id`.
4. Calls:
   - `submissionService.getLeaderboard(scope, cycleId, 15)`.
   - Returns an array of entries with username and `totalTc`.
5. If leaderboard is empty:
   - Sends a “No submissions found” message.
6. Otherwise:
   - Builds an embed:
     - Title: “Tester Army Leaderboard – This Week” or “All Time”.
     - Each line: medal (`🥇`, `🥈`, `🥉` or `index+1.`), username, total gems and gem emoji.
     - Footer explaining that totals include all points and can be reduced after admin review.

### 5.4 Admin commands overview (`AdminCommands`)

**File:** `src/discord/commands/admin.commands.ts`

All admin commands require `PermissionFlagsBits.Administrator` and check permissions in their handlers.

Key commands:

- **`/build launch`**:
  - Args: `build_name`, `app_store_link`, `google_play_link`.
  - Calls `cycleService.launchNewBuild({ buildVersion, appStoreLink, googlePlayLink, createdBy })`.
  - Sends an announcement embed to `discord.channels.announcements`:
    - Includes build version, store links, build start date, and information about the 200 gems per build cap (for regular submissions) and cap‑exempt bonus points.

- **`/award delivered`**:
  - Args:
    - `identifiers` – comma‑separated list of Discord IDs or emails.
    - `points` – gems per user.
    - `reason` – text describing why they are rewarded (e.g. “Video Session”, “Playtime”, etc.).
  - For each identifier:
    - If it looks like an email:
      - `playerService.resolveToDiscordId(email, email, true)` (creates temp player if needed).
    - If Discord ID:
      - Ensures a `Player` exists (creates placeholder if not).
  - Calls:
    - `submissionService.awardDeliveredFeatures(discordUserIds, 'video_session', points, payload, ..., awardedBy)`.
    - Uses special submission type `'video_session'` to treat these as cap‑exempt bonuses.
  - For each non‑temp user:
    - Builds a “Contribution Rewarded” message using `DiscordService.buildContributionRewardedMessage`.
    - Sends to `discord.channels.highlights`.
  - Replies to admin summarizing who got points and who failed (e.g. temp users, channel misconfig).

- **`/shipped`**:
  - Args: `user` and `public_message`.
  - Calls:
    - `submissionService.createSubmission(userId, 'shipped_bonus', { publicMessage }, ..., 'approved')`.
  - Posts message to highlights channel: `SHIPPED: <@user> - public_message`.
  - Replies with success and `+100` gems mention.

- **`/tc adjust`**:
  - Args: `user`, `delta`, `reason`.
  - Ensures user exists via `playerService.upsertUser`.
  - Calls:
    - `submissionService.createManualAdjustment(userId, delta, reason, adminId)`.
  - If highlights channel is configured and `delta !== 0`:
    - Uses `buildContributionRewardedMessage` to post “Contribution Rewarded” style message.
  - Replies summarizing adjustment.

- **`/report weekly`**:
  - Arg: `cycle_id`.
  - Calls:
    - `submissionService.getLeaderboard('week', cycleId, 10)`.
    - `cycleService.getCycle(cycleId)`.
  - Builds an embed for top 10 testers with gems.

- **`/rank sync`**:
  - Optional `user` arg.
  - If `user` provided:
    - Loads tester record; if missing, warns admin.
    - Calls `rankService.evaluateRank(user.id)` + `rankService.syncDiscordRoles(user.id, guild)`.
  - If no `user`:
    - Gets all active testers via `testerArmyService.getAllActiveTesters()`.
    - For each:
      - Evaluates rank and syncs roles.
    - Replies with counts of synced and changed.

- **`/player-id set` / `/player-id add`**:
  - Uses `PlayerBuildIdService` and `BUILD_VERSIONS` list.
  - `/player-id set`:
    - For current user: stores or updates in‑game `playerId` for a chosen build version.
  - `/player-id add`:
    - Admin‑only: sets `playerId` for another user and build version.

- **`/sheets sync`**:
  - Manually runs full Google Sheets sync:
    - `googleSheetsService.manualSync()` → resets internal counters and processes all rows in all configured sheets.
  - Replies with embed summarizing that new submissions have been created or updated.

- **`/sheets sync-individual`**:
  - Arg: `user`.
  - Requires that user has a valid email set.
  - Calls:
    - `googleSheetsService.syncForUserByEmail(email)` – processes only rows whose email matches across:
      - Main structured report sheet.
      - Per‑build structured report sheets.
      - Record your session sheet.
  - Replies with how many rows were processed.

---

## 6. Points / Gems (TC) – Calculation Model

### 6.1 Concepts

- **Gems** = TC points – one numeric field on the submissions and totals.
- Each `Submission` has:
  - `type` – e.g. `bug_repro`, `bug_video`, `balance_analysis`, `survey`, `structured_report_bonus`, `video_session`, `manual_adjust`, `shipped_bonus`, `retest`, etc.
  - `status` – `pending`, `approved`, or `declined`.
  - `tcProposed` – proposed points from forms/QA.
  - `tcAwarded` – points actually counted as confirmed.
  - `qaStatus` / `qaBuildVersion` – QA metadata from Google Sheets.
  - `cycleId` – weekly cycle / build context.
- There is a **build cap**: up to **200 gems per tester per build** from **regular submissions**.
  - Certain awards (like `video_session` delivered features, structured report bonuses, sometimes record session) are **exempt** from this per‑build cap.

### 6.2 How Google Sheets rows become submissions (`GoogleSheetsService`)

**File:** `src/google-sheets/google-sheets.service.ts`

#### 6.2.1 Configuration & credentials

- Read via `ConfigService`:
  - `googleSheets.serviceAccountKey` – JSON string or path to credentials JSON.
  - `googleSheets.spreadsheetId` – main structured report sheet ID.
  - `googleSheets.range` – e.g. `Sheet1!A:Z`.
  - `googleSheets.structuredReportBuilds` – array of `{ version, spreadsheetId }` for each build’s structured report responses.
  - `googleSheets.recordSessionSpreadsheet` – ID for “Record your session” sheet.
- Private key handling:
  - If `credentials.private_key` is not a real PEM, it may be the name of an env var (e.g. `GOOGLE_API_KEY`).
  - `resolvePrivateKeyFromEnv`:
    - First tries `process.env[envVarName]`.
    - Otherwise tries reading `.env` files and parsing the key.
    - Also supports loading the key from a `.pem`/`.key` file path.

#### 6.2.2 Header parsing

`parseHeaderRow(headerRow: string[])`:

- Normalizes header text and maps:
  - `timestamp` – timestamp column.
  - `email` – columns like “email”, “e-mail”, “email address”, etc.
  - `playerId` – columns including “player id” or “uid”.
  - `reportType` – “Type of report”, “Report type”.
  - `buildVersion` – build version columns.
  - `qaStatus` – “Before QA approve”, “QA approve” etc.
  - `qaBuildVersion` – “QA answer”, “Build will be applied”.
  - `points` – “Points to distribute” or similar.
  - `pointsToAssign` – e.g. “HOW MANY POINTS TO ASSIGN?”.

#### 6.2.3 Regular structured reports (main sheet) – `processStructuredReportRow`

Flow (simplified):

1. **Extract email:**
   - First tries the `email` column.
   - If not found or invalid, scans all cells for something that looks like an email.
   - If still no valid email → skip row (logs warning).
2. **Player ID & identifier:**
   - Reads `playerId` column if available (often column C).
   - Uses the non‑email value as optional `identifier` (can change from build to build).
3. **Resolve to Discord user:**
   - `playerService.resolveToDiscordId(identifier || email, email, true)`:
     - Primary key for resolution.
     - Can create temp players.
   - If still no Discord ID → log and skip.
   - Ensures `Player` exists and updates fields:
     - `playerService.updatePlayerFields(discordUserId, identifier, email)`.
4. **Tester membership:**
   - Loads tester record via `testerArmyService.getTester(discordUserId)`.
   - If missing or not active → logs but still proceeds (in case user joins later).
5. **Determine submission type:**
   - Parses the `reportType` column.
   - If it includes “balance” → `balance_analysis`.
   - If it includes “video” → `bug_video`.
   - Otherwise → `bug_repro`.
6. **Points:**
   - Reads from a `points` column if defined.
   - If none, parses values from text like `(30 Gems)` / `(25)` / `(30 TC)` in the `reportType` string.
7. **QA status & build version:**
   - `qaStatus`:
     - If contains “QA please check” → `qa_please_check`.
     - If contains “no need” + “auto” → `no_need_auto_points`.
     - If contains “no need” + “duplicate” → `no_need_duplicate`.
   - `qaBuildVersion` – value from QA build version column.
8. **Initial status & awarded TC:**
   - Defaults: `status = 'pending'`, `tcAwarded = 0`.
   - If `qaStatus = 'no_need_auto_points'`:
     - `status = 'approved'`, `tcAwarded = points || 0`.
   - If `qaStatus = 'no_need_duplicate'`:
     - `status = 'declined'`, `tcAwarded = 0`.
   - If `qaStatus = 'qa_please_check'` AND `qaBuildVersion` is already set:
     - `status = 'approved'`, `tcAwarded = points || 0`.
9. **Cycle association:**
   - Gets active cycle via `cycleService.getActiveCycle()` and uses its `id`.
10. **Duplicate detection and updates:**
    - Primary lookup:
      - `submissionService.findSubmissionByGoogleTimestamp(discordUserId, timestamp, submissionType, email)`.
    - If found:
      - If `discordUserId` changed (e.g. temp → real), updates submission owner.
      - If QA status / build version / points changed:
        - Calls `submissionService.updateQaStatus(id, qaStatus, qaBuildVersion, points)`.
        - If build version was just added (was empty, now set) → `sendBuildVersionNotification(discordUserId, qaBuildVersion)`.
    - If not found:
      - Second lookup by `email + timestamp + type` to avoid duplicates if Discord ID mapping changed.
      - If still not found:
        - Creates a new structured report submission via:
          - `submissionService.createStructuredReportSubmission(discordUserId, submissionType, payload, [], cycleId, initialStatus, points || 0, qaStatus, qaBuildVersion)`.
        - Sends a highlight notification (`sendHighlightNotification`) showing the user and points (if any).
        - If QA build version is present, sends build version notification.

#### 6.2.4 Structured report builds (per build sheets) – `processStructuredReportBuildRow`

Flow:

1. Extract email from `email` column; skip invalid.
2. Read timestamp from `timestamp` column.
3. Resolve Discord user:
   - `playerService.resolveToDiscordId(email, email, true)` and update `Player.email`.
4. Read `pointsToAssign` (HOW MANY POINTS TO ASSIGN?):
   - If non‑empty and positive:
     - `points = parsedValue`, `status = 'approved'`, `tcAwarded = points`.
   - If empty:
     - `points = null`, `status = 'pending'`, `tcAwarded = 0`.
5. Associate to active cycle if present.
6. Duplicate detection:
   - Uses `findSubmissionByGoogleTimestamp(discordUserId, timestamp, 'balance_analysis', email)`.
7. If exists:
   - If points assigned:
     - Use `updateQaStatus` and `updateSubmissionStatusAndPoints` to set `approved` and update `tcAwarded`.
   - If no points:
     - Ensure status is `pending` and `tcAwarded = 0`.
8. If new:
   - Create with:
     - `type = 'balance_analysis'`.
     - Payload includes `structuredReportBuild: true` and `buildVersion`.
     - Status is `pending` or `approved` depending on points.
   - Send highlight notification only if there are points to show.

#### 6.2.5 “Record your session” sheet – `processRecordSessionRow`

Flow:

1. Extract email and timestamp; skip invalid.
2. Resolve Discord user and update `Player.email`.
3. Read `pointsToAssign` column:
   - Non‑empty and positive:
     - `points = parsedValue`, `status = 'approved'`, `tcAwarded = points`.
   - Empty:
     - `points = null`, `status = 'pending'`, `tcAwarded = 0`.
4. Associate to active cycle.
5. Duplicate detection:
   - Uses `findSubmissionByGoogleTimestamp(discordUserId, timestamp, 'bug_video', email)`.
6. If exists:
   - Updates QA data and/or status/points as needed.
7. If new:
   - Creates a submission with:
     - `type = 'bug_video'`.
     - Payload includes `recordSession: true` and `reason: 'Record your session'`.
   - Ensures status and `tcAwarded` match points logic.
   - Sends a highlight notification if there are points to show.

#### 6.2.6 Highlight & build fix notifications

- **Highlight notification** (`sendHighlightNotification`):
  - Topic: `discord.channels.highlights`.
  - Only sends if:
    - `pointsAwarded > 0`, or
    - `pointsProposed > 0`.
  - Message structure:
    - Title: “New Feedback Submitted”.
    - Mentions user and human‑friendly submission type:
      - `bug_repro` → “Bug Reproduction Report”.
      - `bug_video` → “Bug Video Report”.
      - `balance_analysis` → “Balance Analysis Report”.
    - Shows `+{points} gems` (using gem emoji).
    - Appends leaderboard snippet (`submissionService.getLeaderboardSnippetForUser`) around this user.

- **Build version notification** (`sendBuildVersionNotification`):
  - Also posts to highlights channel.
  - Message: thanks the player and announces that a fix will appear in a given build version.

---

## 7. Weekly Cycles & Builds

Weekly cycles are managed by `CycleService` (used in several places).

Concepts:

- A **cycle** is a weekly testing period tied to a specific **build version** (e.g. `2.10`, `2.11`, ...).
- `/build launch`:
  - Closes previous build’s cycle (if any).
  - Opens a new cycle for the new build.
  - Broadcasts a Discord announcement.
- Many methods that use `scope = 'week'` (for example, weekly leaderboard and weekly report) filter submissions by `cycleId`.

Submissions:

- Created via `createSubmission` / `createStructuredReportSubmission` with an optional `cycleId`.
- Leaderboards with:
  - `scope = 'week'` + `cycleId` use this to compute totals only for that weekly build period.

---

## 8. Ranks & Roles

Rank mechanics are implemented primarily in `RankService` (not fully shown here but inferred from usage).

Concepts:

- `TesterArmyService` tracks testers with `status` (e.g. `active`).
- `RankService`:
  - `evaluateRank(discordUserId)`:
    - Inspects confirmed gems (`tcConfirmedTotal`) and chooses a rank:
      - E.g. `recruit`, `explorer`, `test_pilot`, `founders_circle`.
  - `syncDiscordRoles(discordUserId, guild)`:
    - Maps rank to Discord role names and assigns/removes roles on the guild.
- Calls to rank logic:
  - On member join (`DiscordService.handleMemberJoin`).
  - On member role changes / nickname updates (`handleMemberUpdate`).
  - On `/founders profile` before showing the profile.
  - On `/rank sync` admin command, both per user and for all active testers.

The profile embed uses a `rankDisplayNames` map to convert internal rank keys to nice display names.

---

## 9. Environment & Configuration – What Needs to Be Set

The bot uses both `.env` and `ConfigModule` (`src/config/config.ts`). Important keys:

### 9.1 Discord

- `DISCORD_BOT_TOKEN` (or `discord.token`) – bot token.
- Optional `DISCORD_GUILD_ID` (`discord.guildId`) – if set, commands are guild‑only.
- `discord.channels.announcements` – channel ID for build announcements.
- `discord.channels.highlights` – channel ID for highlight / reward messages.

### 9.2 Forms (URLs)

Typically defined either as `FORM_*` env vars or under `forms.*` in config:

- `FORM_SCREENSHOT` / `forms.screenshot`.
- `FORM_BUG_REPRO` / `forms.bugRepro`.
- `FORM_BUG_VIDEO` / `forms.bugVideo`.
- `FORM_BALANCE_ANALYSIS` / `forms.balanceAnalysis`.
- `FORM_RETEST` / `forms.retest`.
- `FORM_RECORD_SESSION` / `forms.recordSession`.
- `FORM_STRUCTURED_REPORT_LINKS` / `forms.structuredReportLinks` (comma‑separated URLs for 8‑week rotation).
- `forms.structuredReportBuilds` – array of `{ version, formUrl }` for per‑build structured reports.
- `FORM_STRUCTURED_REPORT` / `forms.structuredReport` – fallback structured report URL.

### 9.3 Google Sheets

- `googleSheets.serviceAccountKey` – JSON string or path to service account JSON.
- `googleSheets.spreadsheetId` – main structured report sheet ID.
- `googleSheets.range` – e.g. `Sheet1!A:Z`.
- `googleSheets.structuredReportBuilds` – array describing per‑build sheets.
- `googleSheets.recordSessionSpreadsheet` – sheet ID for “Record your session”.

### 9.4 Program roles

- `program.roles` – array of Discord role names that mark people as part of Tester Army / Founders program.

### 9.5 Database

- PG connection env vars or config for TypeORM (via `src/config/typeorm.config.ts` and `DatabaseModule`).
- `main.ts` clears some default `PG*` env vars so NestJS config is the single source of truth.

---

## 10. How to Use This Document with ChatGPT

When starting a new ChatGPT (or other AI) session about this bot, paste this file (or a link to it) and say something like:

> “This is the architecture of our Monopoly World Tester Army bot. Please use it as context. I want to change X…”

This gives the assistant:

- A clear map of **which class is responsible for what**.
- Understanding of the **points system**, **forms**, **Google Sheets ingestion**, and **rank logic**.
- Knowledge of **commands and flows** so new features can be added or bugs fixed without breaking core mechanics.

