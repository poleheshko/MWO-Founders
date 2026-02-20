import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Client,
  GatewayIntentBits,
  GuildMember,
  TextChannel,
  EmbedBuilder,
} from 'discord.js';
import { PlayerService } from '../player/player.service';
import { TesterArmyService } from '../tester-army/tester-army.service';
import { SubmissionService } from '../submission/submission.service';
import { RankService } from '../rank/rank.service';
import { CycleService } from '../cycle/cycle.service';

@Injectable()
export class DiscordService implements OnModuleInit, OnModuleDestroy {
  private client: Client;
  private readonly guildId: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly playerService: PlayerService,
    private readonly testerArmyService: TesterArmyService,
    private readonly submissionService: SubmissionService,
    private readonly rankService: RankService,
    private readonly cycleService: CycleService,
  ) {
    this.guildId = this.configService.get('discord.guildId');
  }

  async onModuleInit() {
    const token = this.configService.get('discord.token');
    if (!token) {
      throw new Error('DISCORD_BOT_TOKEN is not set');
    }

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
      // Auto-reconnect configuration
      rest: {
        retries: 5,
        timeout: 30000,
      },
    });

    this.setupEventHandlers();
    
    try {
      await this.client.login(token);
      console.log('✅ Discord bot logged in');
    } catch (error) {
      console.error('❌ Failed to login to Discord:', error);
      // Retry login after delay
      setTimeout(async () => {
        try {
          await this.client.login(token);
          console.log('✅ Discord bot reconnected after error');
        } catch (retryError) {
          console.error('❌ Retry login failed:', retryError);
        }
      }, 5000);
    }
  }

  async onModuleDestroy() {
    await this.client.destroy();
  }

  private setupEventHandlers() {
    this.client.once('ready', () => {
      console.log(`✅ Bot ready: ${this.client.user?.tag}`);
      this.registerCommands();
    });

    // Auto-reconnect on disconnect
    this.client.on('disconnect', () => {
      console.warn('⚠️ Discord client disconnected. Will attempt to reconnect...');
    });

    // Handle reconnection
    this.client.on('reconnecting', () => {
      console.log('🔄 Reconnecting to Discord...');
    });

    // Handle errors
    this.client.on('error', (error) => {
      console.error('❌ Discord client error:', error);
      // Don't exit - Discord.js will attempt to reconnect automatically
    });

    // Handle warnings
    this.client.on('warn', (warning) => {
      console.warn('⚠️ Discord client warning:', warning);
    });

    // Handle shard errors (for multi-shard setups)
    this.client.on('shardError', (error, shardId) => {
      console.error(`❌ Shard ${shardId} error:`, error);
    });

    this.client.on('guildMemberAdd', async (member) => {
      await this.handleMemberJoin(member);
    });

    this.client.on('guildMemberUpdate', async (oldMember, newMember) => {
      await this.handleMemberUpdate(newMember);
    });
  }

  private async registerCommands() {
    // Commands will be registered via Discord.js interactions
    // This is handled in the command handlers
  }

  private async handleMemberJoin(member: GuildMember) {
    if (member.user.bot) return;

    // Check if there's a temporary player that should be updated to this Discord ID
    // Note: We can't get email from Discord API, but we can check by Player ID if available
    // The syncAllMembers method will handle email matching when syncing from Google Sheets
    await this.playerService.updateTempDiscordId(member.id);

    // Ensure player exists in database
    await this.playerService.getPlayerOrCreate(
      member.id,
      member.user.username,
      member.displayName,
    );

    const roles = member.roles.cache.map((r) => r.name);
    await this.testerArmyService.syncMembership(
      member.id,
      member.user.username,
      member.displayName,
      roles,
    );

    // Evaluate rank for new member (will be recruit if no gems)
    const tester = await this.testerArmyService.getTester(member.id);
    if (tester) {
      await this.rankService.evaluateRank(member.id);
      const guild = member.guild;
      await this.rankService.syncDiscordRoles(member.id, guild);
    }
  }

  private async handleMemberUpdate(member: GuildMember) {
    if (member.user.bot) return;

    // Ensure player exists in database and update username/nickname
    await this.playerService.upsertPlayer(
      member.id,
      member.user.username,
      member.displayName,
    );

    const roles = member.roles.cache.map((r) => r.name);
    await this.testerArmyService.syncMembership(
      member.id,
      member.user.username,
      member.displayName,
      roles,
    );

    // Re-evaluate rank and sync roles
    const tester = await this.testerArmyService.getTester(member.id);
    if (tester) {
      await this.rankService.evaluateRank(member.id);
      const guild = member.guild;
      await this.rankService.syncDiscordRoles(member.id, guild);
    }
  }

  getClient(): Client {
    return this.client;
  }

  async getGuild() {
    return await this.client.guilds.fetch(this.guildId);
  }

  async sendToChannel(channelId: string, content: string) {
    const channel = (await this.client.channels.fetch(
      channelId,
    )) as TextChannel;
    if (channel) {
      await channel.send(content);
    }
  }

  async sendEmbedToChannel(channelId: string, embed: EmbedBuilder) {
    const channel = (await this.client.channels.fetch(
      channelId,
    )) as TextChannel;
    if (channel) {
      await channel.send({ embeds: [embed] });
    }
  }

  /**
   * Send a direct message to a user
   * @param userId Discord user ID
   * @param content Message content
   * @returns true if message was sent successfully, false otherwise
   */
  getGemEmoji(): string {
    const emoji = this.client?.emojis?.cache?.find((e) => e.name === 'gem~1');
    return emoji ? `<:gem~1:${emoji.id}>` : '💎';
  }

  async sendDM(userId: string, content: string): Promise<boolean> {
    try {
      const user = await this.client.users.fetch(userId);
      if (!user) {
        return false;
      }
      await user.send(content);
      return true;
    } catch (error) {
      console.error(`Failed to send DM to user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Synchronize all Discord members to players table
   * Adds missing members to the database
   */
  async syncAllMembers(): Promise<{ added: number; updated: number; total: number }> {
    const guild = await this.getGuild();
    const members = await guild.members.fetch();

    let added = 0;
    let updated = 0;

    for (const [, member] of members) {
      if (member.user.bot) continue;

      try {
        // Check if player exists
        const existingPlayer = await this.playerService.getPlayer(member.id);

        if (!existingPlayer) {
          // Add new player to database
          await this.playerService.upsertPlayer(
            member.id,
            member.user.username,
            member.displayName,
          );
          added++;
        } else {
          // Update username and nickname if changed
          if (
            existingPlayer.discordUsername !== member.user.username ||
            existingPlayer.discordNickname !== member.displayName
          ) {
            await this.playerService.upsertPlayer(
              member.id,
              member.user.username,
              member.displayName,
            );
            updated++;
          }
        }

        // Sync membership (for tester army)
        const roles = member.roles.cache.map((r) => r.name);
        await this.testerArmyService.syncMembership(
          member.id,
          member.user.username,
          member.displayName,
          roles,
        );
      } catch (error) {
        console.error(`Error syncing member ${member.id}:`, error);
      }
    }

    return {
      added,
      updated,
      total: members.size,
    };
  }
}
