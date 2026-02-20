# How to Participate in the Program and Use the Bot

Step-by-step instructions for joining the **Tester Army** (Monopoly World Founders Circle) and using the Discord bot.

---

## Step 1: Join the program

1. **Open the program sign-up form**  
   Use the link provided by your server (e.g. in the welcome channel or from an admin).  
   If your server uses the default form, it is:  
   [Join the Tester Army](https://docs.google.com/forms/d/e/1FAIpQLSes_BYNWA3ICKtaBUSfGODw7sE5jqEQDEequF0TQQNUANu-3g/viewform?usp=sharing&ouid=105415417568017069950)

2. **Fill out the form**  
   Use the **same email address** you will use in Discord and in all submission forms later. This links your submissions to your account.

3. **Wait for your role**  
   After your application is accepted, you will receive a program role on the Discord server (e.g. **Tester Recruit**). The bot syncs membership based on this role.

---

## Step 2: Add your email in Discord (required)

Before using any bot commands, you must register your email with the bot so it can link your Discord account to your form submissions.

1. In Discord, open the channel where the bot is available.
2. Type: **`/founders add-email`**
3. When prompted, enter **email:** and use the **exact same email** you used in the sign-up form and will use in all submission forms.
4. Confirm. The bot will save your email (only you and admins can see the reply).

You only need to do this once. Without it, commands like `/participate`, `/founders profile`, and `/leaderboard` will ask you to add your email first.

---

## Step 3: Get submission links with `/participate`

When you’re ready to submit contributions (screenshots, bug reports, balance feedback, etc.):

1. In Discord, type: **`/participate`**
2. The bot will reply with **buttons** that open the correct submission forms for:
   - Screenshots  
   - Bug reports (with or without video)  
   - Balance analysis  
   - Retests  
   - Structured report (if available for the current cycle)

Use these links to submit; use the **same email** you set with `/founders add-email` in the forms so your Gems are attributed to you.

---

## Step 4: Check your profile and Gems

- **`/founders profile`**  
  Shows your Tester Army profile:  
  - Confirmed and pending Gems  
  - Current rank  
  - Recent submissions  

Use this to confirm that your submissions are linked to your account and to see when they are approved.

---

## Step 5: See rankings (optional)

- **`/leaderboard`**  
  Shows the full leaderboard (all-time).  
- **`/leaderboard scope:week`**  
  Shows the leaderboard for the current week.

---

## Quick reference: main commands

| Command | What it does |
|--------|-------------------------------|
| `/founders add-email` | Set your email (required first step; use same email as in forms). |
| `/participate` | Get buttons with links to all submission forms. |
| `/founders profile` | View your Gems, rank, and recent submissions. |
| `/leaderboard` | View full leaderboard. |
| `/leaderboard scope:week` | View this week’s leaderboard. |

---

## Gems and ranks

- You earn **Gems** for approved submissions (screenshots, bug reports, balance analysis, retests, etc.).  
- Gems can be **pending** (awaiting review) or **confirmed** (added to your total).  
- Your **rank** is updated automatically from your confirmed Gems (and other criteria), e.g. Tester Recruit → Explorer → Test Pilot → Founders Circle.  
- Check **`/founders profile`** to see your current Gems and rank.

---

## Troubleshooting

- **“Email required”**  
  Run **`/founders add-email`** and enter the same email you use in the submission forms.

- **“You are not a member of the Tester Army”**  
  You need a program role on the server. Complete the join form (Step 1) and wait until you receive the role.

- **Bot doesn’t respond**  
  Ensure the bot is online, you have the right role, and you’re typing the command in a channel where the bot can read and reply (e.g. with `/` slash commands).

- **Links in `/participate` missing or wrong**  
  Form links are configured by server admins. If something is missing, ask an admin to check the bot’s form link configuration.

- **Submissions not showing as confirmed**  
  Submissions are reviewed by admins. Pending items appear in **`/founders profile`** until they are approved and turn into confirmed Gems.

---

## Summary checklist

1. ✅ Join the program via the sign-up form (use your chosen email).  
2. ✅ Get the program role on Discord.  
3. ✅ Run **`/founders add-email`** with that same email.  
4. ✅ Use **`/participate`** to get submission links and submit with the same email.  
5. ✅ Use **`/founders profile`** to track your Gems and rank.  
6. ✅ Use **`/leaderboard`** to see rankings when you want.

After that, use **`/participate`** whenever a new build or cycle is announced to get the right links and keep submitting with your registered email.
