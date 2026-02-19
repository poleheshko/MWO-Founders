import os
import csv
import psycopg2
import discord
import threading
from discord import app_commands
from flask import Flask
from flask_app.app import app
from datetime import datetime
from discord.ext import commands
from discord import Intents
from dotenv import load_dotenv

load_dotenv()

# Initialize the bot
intents = discord.Intents.default()
intents.members = True  # Enable members intent
bot = commands.Bot(command_prefix="!", intents=intents)

# Function to create or update the players table
def get_db_connection():
    try:
        database_url = os.environ['DATABASE_URL']
        if not database_url:
            raise ValueError("DATABASE_URL is empty")
        return psycopg2.connect(database_url)
    except Exception as e:
        print(f"Database connection error: {e}")
        return None

def create_table():
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
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
                    top_role TEXT
                )
            ''')
            conn.commit()
    except Exception as e:
        print(f"Error creating the table: {e}")


# Initialize bot
class MyBot(discord.Client):
    def __init__(self, intents):
        super().__init__(intents=intents)
        self.tree = app_commands.CommandTree(self)

    async def on_ready(self):
        print(f"✅ Logged in as {self.user} (ID: {self.user.id})")
        try:
            # Sync commands globally
            await self.tree.sync()  # Sync commands globally across all servers
            print("🌐 Slash commands synced globally!")
        except Exception as e:
            print(f"Error syncing commands globally: {e}")

# Call create_table once at the start to ensure the table is ready
create_table()

# Helper function to refresh a user's info in the database
def update_user_info(discord_id, discord_username, player_id=None, roles=None, discord_nickname=None, member=None, server_join_date=None, account_creation_date=None, top_role=None):
    roles_str = ", ".join(roles) if roles else "No roles"
    discord_nickname = discord_nickname or "No nickname"
    server_join_date = member.joined_at.strftime("%Y-%m-%d") if member and member.joined_at else "Unknown"
    account_creation_date = member.created_at.strftime("%Y-%m-%d") if member and member.created_at else "Unknown"
    top_role = member.top_role.name if member and member.top_role else "No role"

    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Always fetch the existing player_id if not provided
        if not player_id or player_id.strip() == "":
            cursor.execute("SELECT player_id FROM players WHERE discord_id = %s", (discord_id,))
            result = cursor.fetchone()
            if result and result[0]:
                player_id = result[0]  # Keep the existing player_id
            else:
                player_id = None  # No player_id exists for this user

        print(f"Debug - Preparing to insert/update: Discord ID: {discord_id}, Player ID: {player_id}, Roles: {roles_str}")

        # Insert or update the user data
        cursor.execute('''
            INSERT INTO players (
                discord_id, discord_username, discord_nickname, player_id,
                mwo_username, roles, player_level, board_value,
                server_join_date, account_creation_date, top_role
            )
            VALUES (%s, %s, %s, %s, '', %s, %s, %s, %s, %s, %s)
            ON CONFLICT(discord_id) DO UPDATE SET
                discord_username = EXCLUDED.discord_username,
                discord_nickname = EXCLUDED.discord_nickname,
                roles = EXCLUDED.roles,
                player_id = COALESCE(EXCLUDED.player_id, players.player_id), -- Keep original player_id if EXCLUDED is None
                server_join_date = EXCLUDED.server_join_date,
                account_creation_date = EXCLUDED.account_creation_date,
                top_role = EXCLUDED.top_role
        ''', (
            discord_id, discord_username, discord_nickname, player_id,
            roles_str, None, None, server_join_date, account_creation_date, top_role
        ))

        conn.commit()
        print(f"Updated user {discord_username} with Player ID: {player_id}, Roles: {roles_str}")



@bot.tree.command(name="sync", description="Sync commands (Admin only)")
async def sync(interaction: discord.Interaction):
    if not interaction.user.guild_permissions.administrator:
        await interaction.response.send_message("You must be an admin to use this command!", ephemeral=True)
        return
    await bot.tree.sync(guild=discord.Object(id=interaction.guild_id))
    await interaction.response.send_message("Commands synced!", ephemeral=True)

# /refreshdatabase command for moderators only
@bot.tree.command(name="refreshdatabase", description="Moderator-only: Refresh the entire database")
async def refreshdatabase(interaction: discord.Interaction):
    try:
        if not interaction.user.guild_permissions.administrator:
            await interaction.followup.send("❌ You do not have permission to use this command.", ephemeral=True)
            return

        await interaction.response.defer(ephemeral=True)
        print("Debug: /refreshdatabase command triggered.")

        guild = interaction.guild
        if not guild:
            await interaction.followup.send("❌ This command can only be used in a server.", ephemeral=True)
            return

        members_data = []  # Collect all member data here for batch processing

        try:
            async for member in guild.fetch_members():
                if not member.bot:
                    discord_id = str(member.id)
                    discord_username = str(member)
                    discord_nickname = member.display_name
                    roles = [role.name for role in member.roles if role.name != "@everyone"]
                    server_join_date = member.joined_at.strftime("%Y-%m-%d") if member.joined_at else "Unknown"
                    account_creation_date = member.created_at.strftime("%Y-%m-%d") if member.created_at else "Unknown"
                    top_role = member.top_role.name if member.top_role else "No role"

                    members_data.append((
                        discord_id, discord_username, discord_nickname, roles,
                        server_join_date, account_creation_date, top_role
                    ))
                    print(f"Collected data for member: {discord_username} ({discord_id})")
        except Exception as fetch_error:
            print(f"Error fetching members: {type(fetch_error).__name__} - {str(fetch_error)}")
            await interaction.followup.send("❌ An error occurred while fetching server members. Check the logs.", ephemeral=True)
            return

        # Perform bulk database update
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()

                for data in members_data:
                    discord_id, discord_username, discord_nickname, roles, server_join_date, account_creation_date, top_role = data

                    # Fetch existing player_id (if it exists)
                    cursor.execute("SELECT player_id FROM players WHERE discord_id = %s", (discord_id,))
                    result = cursor.fetchone()
                    player_id = result[0] if result else None

                    # Convert roles to a string for storage
                    roles_str = ", ".join(roles) if roles else "No roles"

                    # Perform insert or update
                    cursor.execute('''
                        INSERT INTO players (
                            discord_id, discord_username, discord_nickname, player_id,
                            mwo_username, roles, player_level, board_value,
                            server_join_date, account_creation_date, top_role
                        )
                        VALUES (%s, %s, %s, %s, '', %s, NULL, NULL, %s, %s, %s)
                        ON CONFLICT(discord_id) DO UPDATE SET
                            discord_username = EXCLUDED.discord_username,
                            discord_nickname = EXCLUDED.discord_nickname,
                            roles = EXCLUDED.roles,
                            player_id = COALESCE(EXCLUDED.player_id, players.player_id),
                            server_join_date = EXCLUDED.server_join_date,
                            account_creation_date = EXCLUDED.account_creation_date,
                            top_role = EXCLUDED.top_role
                    ''', (
                        discord_id, discord_username, discord_nickname, player_id,
                        roles_str, server_join_date, account_creation_date, top_role
                    ))

                conn.commit()
                print(f"Database updated for {len(members_data)} members.")
        except Exception as db_error:
            print(f"Error updating database: {type(db_error).__name__} - {str(db_error)}")
            await interaction.followup.send("❌ An error occurred while updating the database. Check the logs.", ephemeral=True)
            return

        await interaction.followup.send(f"✅ Database refreshed. {len(members_data)} users updated.", ephemeral=True)

    except Exception as e:
        print(f"Unexpected error in /refreshdatabase: {type(e).__name__} - {str(e)}")
        await interaction.followup.send("❌ An unexpected error occurred. Check the logs.", ephemeral=True)



# /verifyplayerid command
@bot.tree.command(name="verifyplayerid", description="Verify a player ID (can be used only once)")
async def verifyplayerid(interaction: discord.Interaction, player_id: str):
    await interaction.response.defer(ephemeral=True)
    discord_id = str(interaction.user.id)
    discord_username = str(interaction.user)
    roles = [role.name for role in interaction.user.roles if role.name != "@everyone"]
    # Check if the user already exists in the database
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT player_id FROM players WHERE discord_id = %s", (discord_id,))
        existing_player = cursor.fetchone()
    # If player_id already exists, prompt to use /changeuserid instead
    if existing_player and existing_player[0] not in (None, ""):
        await interaction.followup.send("⚠️ You have already set your Player ID. Use /changeuserid to update it.", ephemeral=True)
        return
    # Insert player info into the database
    try:
        update_user_info(discord_id, discord_username, player_id, roles)
        await interaction.followup.send(f"✅ **Player ID** {player_id} verified for <@{discord_id}> 🎉 Server rewards are sent in the game on **Mondays, Wednesdays and Fridays**.", ephemeral=True)
        # Update CSV and backup after insertion
    except Exception as e:
        await interaction.followup.send("❌ An error occurred while updating the database. Please try again or contact support.", ephemeral=True)
        print(f"Error: {e}")

# /changeuserid command
@bot.tree.command(name="changeuserid", description="Change your Player ID")
async def changeuserid(interaction: discord.Interaction, new_player_id: str):
    await interaction.response.defer(ephemeral=True)  # Acknowledge the interaction immediately

    discord_id = str(interaction.user.id)
    discord_username = str(interaction.user)
    roles = [role.name for role in interaction.user.roles if role is not None and role.name != "@everyone"]

    # Update the player's ID and refresh their roles in the database
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('UPDATE players SET player_id = %s WHERE discord_id = %s', (new_player_id, discord_id))
            conn.commit()

        # Refresh roles and username
        update_user_info(discord_id, discord_username, new_player_id, roles)

        await interaction.followup.send(f"🔄 Your Player ID has been updated to **{new_player_id}**", ephemeral=True)

    except Exception as e:
        await interaction.followup.send("❌ An error occurred while updating your Player ID. Please try again or contact support at <#1205554241180147752>.", ephemeral=True)
        print(f"Error: {e}")

# /profile command
@bot.tree.command(name="profile", description="Get your profile information")
async def profile(interaction: discord.Interaction):
    await interaction.response.defer(ephemeral=True)  # Acknowledge the interaction immediately

    discord_id = str(interaction.user.id)
    discord_username = str(interaction.user)
    roles = [role.name for role in interaction.user.roles if role is not None and role.name != "@everyone"]

    # Refresh roles and username in the database
    update_user_info(discord_id, discord_username, roles=roles)

    # After updating user info
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM players WHERE discord_id = %s", (discord_id,))
        updated_user = cursor.fetchone()

    if not updated_user:
        await interaction.followup.send("🚫 User not found after updating.", ephemeral=True)
    else:
        player_id = updated_user[2]

    # Query player info from database
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT discord_id, discord_username, player_id, mwo_username, roles, player_level, board_value FROM players WHERE discord_id = %s', (discord_id,))
            row = cursor.fetchone()

        if row:
            player_id = row[2] if row[2] else "Not set"
            player_level = row[5] if row[5] and row[5].strip() != "" else "Coming soon 🕒"
            board_value = row[6] if row[6] and row[6].strip() != "" else "Coming soon 🏆"
            roles_text = row[4] if row[4] else "No special roles"

            await interaction.followup.send(
                content=(
                    f"👋 Hello <@{discord_id}>! Let's sum up your profile:\n\n"
                    f"**Player ID:** {player_id}\n"
                    f"**Level:** {player_level}\n"
                    f"**Board value:** {board_value}\n\n"
                    f"**Achievements in Discord:** {roles_text}"
                ),
                ephemeral=True
            )
        else:
            await interaction.followup.send(
                content="⚠️ Unfortunately, we haven't found your profile. Please use /verifyplayerid to add your profile.",
                ephemeral=True
            )

    except Exception as e:
        await interaction.followup.send(
            content="❌ An error occurred while fetching the profile. Please try again or contact support at <#1205554241180147752>.",
            ephemeral=True
        )
        print(f"Error: {e}")

# /refreshprofile command
@bot.tree.command(name="refreshprofile", description="Refresh your profile data")
async def refreshprofile(interaction: discord.Interaction):
    await interaction.response.defer(ephemeral=True)  # Acknowledge the interaction immediately

    discord_id = str(interaction.user.id)
    discord_username = str(interaction.user)
    roles = [role.name for role in interaction.user.roles if role is not None and role.name != "@everyone"]

    # Refresh roles and username in the database
    update_user_info(discord_id, discord_username, roles=roles)

    await interaction.followup.send(f"🎉 Congratulations <@{discord_id}>, you've just refreshed your profile data!", ephemeral=True)

if not os.getenv("DISCORD_BOT_TOKEN"):
    raise ValueError("DISCORD_BOT_TOKEN is not set in the environment variables.")
if not os.getenv("DATABASE_URL"):
    raise ValueError("DATABASE_URL is not set in the environment variables.")

for command in bot.tree.walk_commands():
    print(f"Registered command: {command.name}")

app = Flask('')

@app.route('/')
def home():
    return "Bot is running!"

def run_flask():
    app.run(host='0.0.0.0', port=8080, debug=False)

# Run Flask in a separate thread
if __name__ == "__main__":
    threading.Thread(target=run_flask).start()

    # Start the Discord bot in the main thread
    bot.run(os.getenv("DISCORD_BOT_TOKEN"))