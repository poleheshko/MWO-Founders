import { Injectable, OnModuleInit } from '@nestjs/common';
import { Client, REST, Routes } from 'discord.js';
import { ConfigService } from '@nestjs/config';
import { DiscordService } from './discord.service';
import { ProfileCommand } from './commands/profile.command';
import { LeaderboardCommand } from './commands/leaderboard.command';
import { RewardCommand } from './commands/reward.command';
import { AdminCommands } from './commands/admin.commands';
import { ParticipateCommand } from './commands/participate.command';

@Injectable()
export class DiscordCommandService implements OnModuleInit {
  constructor(
    private readonly discordService: DiscordService,
    private readonly configService: ConfigService,
    private readonly profileCommand: ProfileCommand,
    private readonly leaderboardCommand: LeaderboardCommand,
    private readonly rewardCommand: RewardCommand,
    private readonly adminCommands: AdminCommands,
    private readonly participateCommand: ParticipateCommand,
  ) {}

  async onModuleInit() {
    // Wait a bit for Discord client to be ready
    setTimeout(async () => {
      const client = this.discordService.getClient();
      if (client.isReady()) {
        await this.registerCommands(client);
        this.setupInteractionHandlers(client);
      } else {
        client.once('ready', async () => {
          await this.registerCommands(client);
          this.setupInteractionHandlers(client);
        });
      }
    }, 2000);
  }

  private async registerCommands(client: Client) {
    const token = this.configService.get('discord.token');
    const clientId = client.user?.id;
    const guildId = this.configService.get('discord.guildId');

    if (!token || !clientId) {
      console.error('Missing Discord token or client ID');
      return;
    }

    const commands = [
      this.profileCommand.data,
      this.leaderboardCommand.data,
      this.rewardCommand.data,
      this.participateCommand.data,
      this.adminCommands.launchBuild,
      this.adminCommands.awardDeliveredFeatures,
      this.adminCommands.shipped,
      this.adminCommands.tcAdjust,
      this.adminCommands.report,
      this.adminCommands.rankSync,
      this.adminCommands.addPlayerId,
      this.adminCommands.sheetsSync,
    ].map((command) => command.toJSON());

    const rest = new REST({ version: '10' }).setToken(token);

    try {
      console.log('Started refreshing application (/) commands.');

      if (guildId) {
        // Register only guild-specific commands so there is a single set (no duplicates).
        // Clear global commands so we don't show both global + guild in the same server.
        await rest.put(Routes.applicationCommands(clientId), { body: [] });
        await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
          body: commands,
        });
        console.log(`Successfully registered ${commands.length} guild-only commands for guild ${guildId}.`);
        console.log('Note: To use bot on multiple servers, either:');
        console.log('  1. Remove DISCORD_GUILD_ID to register global commands (takes up to 1 hour)');
        console.log('  2. Or register commands manually on each server');
      } else {
        // Register global commands (works on all servers, but takes up to 1 hour to propagate)
        await rest.put(Routes.applicationCommands(clientId), {
          body: commands,
        });
        console.log(`Successfully registered ${commands.length} global commands.`);
        console.log('Note: Global commands may take up to 1 hour to appear on all servers.');
      }
    } catch (error) {
      console.error('Error registering commands:', error);
    }
  }

  private setupInteractionHandlers(client: Client) {
    client.on('interactionCreate', async (interaction) => {
      // Handle button interactions
      if (interaction.isButton()) {
        try {
          if (interaction.customId === 'structured_report_select_build') {
            await this.participateCommand.handleStructuredReportBuildSelection(interaction);
          }
        } catch (error) {
          console.error('Error handling button interaction:', error);
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp({
              content: '❌ An error occurred while processing this interaction.',
              ephemeral: true,
            });
          } else {
            await interaction.reply({
              content: '❌ An error occurred while processing this interaction.',
              ephemeral: true,
            });
          }
        }
        return;
      }

      // Handle slash commands
      if (!interaction.isChatInputCommand()) return;

      const { commandName } = interaction;

      try {
        if (commandName === 'founders') {
          const subcommand = interaction.options.getSubcommand();
          if (subcommand === 'profile' || subcommand === 'add-email') {
            await this.profileCommand.execute(interaction);
          }
        } else if (commandName === 'leaderboard') {
          await this.leaderboardCommand.execute(interaction);
        } else if (commandName === 'reward') {
          await this.rewardCommand.execute(interaction);
        } else if (commandName === 'participate') {
          await this.participateCommand.execute(interaction);
        } else if (commandName === 'build') {
          const subcommand = interaction.options.getSubcommand();
          if (subcommand === 'launch') {
            await this.adminCommands.handleLaunchBuild(interaction);
          }
        } else if (commandName === 'award') {
          const subcommand = interaction.options.getSubcommand();
          if (subcommand === 'delivered') {
            await this.adminCommands.handleAwardDeliveredFeatures(interaction);
          }
        } else if (commandName === 'shipped') {
          await this.adminCommands.handleShipped(interaction);
        } else if (commandName === 'tc') {
          const subcommand = interaction.options.getSubcommand();
          if (subcommand === 'adjust') {
            await this.adminCommands.handleTcAdjust(interaction);
          }
        } else if (commandName === 'report') {
          const subcommand = interaction.options.getSubcommand();
          if (subcommand === 'weekly') {
            await this.adminCommands.handleReportWeekly(interaction);
          }
        } else if (commandName === 'rank') {
          const subcommand = interaction.options.getSubcommand();
          if (subcommand === 'sync') {
            await this.adminCommands.handleRankSync(interaction);
          }
        } else if (commandName === 'player-id') {
          const subcommand = interaction.options.getSubcommand();
          if (subcommand === 'set') {
            await this.adminCommands.handleSetPlayerId(interaction);
          } else if (subcommand === 'add') {
            await this.adminCommands.handleAddPlayerId(interaction);
          }
        } else if (commandName === 'sheets') {
          const subcommand = interaction.options.getSubcommand();
          if (subcommand === 'sync') {
            await this.adminCommands.handleSheetsSync(interaction);
          } else if (subcommand === 'sync-individual') {
            await this.adminCommands.handleSheetsSyncIndividual(interaction);
          }
        }
      } catch (error) {
        console.error(`Error handling command ${commandName}:`, error);
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({
            content: '❌ An error occurred while executing this command.',
            ephemeral: true,
          });
        } else {
          await interaction.reply({
            content: '❌ An error occurred while executing this command.',
            ephemeral: true,
          });
        }
      }
    });
  }
}
