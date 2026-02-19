import { Injectable } from '@nestjs/common';
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import { SubmissionService } from '../../submission/submission.service';
import { CycleService } from '../../cycle/cycle.service';
import { DiscordService } from '../discord.service';
import { ConfigService } from '@nestjs/config';
import { PlayerService } from '../../player/player.service';
import { RankService } from '../../rank/rank.service';
import { TesterArmyService } from '../../tester-army/tester-army.service';
import { GoogleSheetsService } from '../../google-sheets/google-sheets.service';

@Injectable()
export class AdminCommands {
  constructor(
    private readonly submissionService: SubmissionService,
    private readonly cycleService: CycleService,
    private readonly discordService: DiscordService,
    private readonly configService: ConfigService,
    private readonly playerService: PlayerService,
    private readonly rankService: RankService,
    private readonly testerArmyService: TesterArmyService,
    private readonly googleSheetsService: GoogleSheetsService,
  ) {}

  // Launch new build - replaces cycle create/publish. Previous build ends when this is called.
  launchBuild = new SlashCommandBuilder()
    .setName('build')
    .setDescription('Launch a new build')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('launch')
        .setDescription('Launch a new build (closes previous build)')
        .addStringOption((option) =>
          option
            .setName('build_name')
            .setDescription('Build name/version (e.g. 1.2.0)')
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName('app_store_link')
            .setDescription('App Store download link')
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName('google_play_link')
            .setDescription('Google Play download link')
            .setRequired(true),
        ),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

  shipped = new SlashCommandBuilder()
    .setName('shipped')
    .setDescription('Award shipped bonus')
    .addUserOption((option) =>
      option.setName('user').setDescription('User to award').setRequired(true),
    )
    .addStringOption((option) =>
      option.setName('public_message').setDescription('Public message').setRequired(true),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

  tcAdjust = new SlashCommandBuilder()
    .setName('tc')
    .setDescription('Adjust TC manually')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('adjust')
        .setDescription('Adjust TC for a user')
        .addUserOption((option) =>
          option.setName('user').setDescription('User').setRequired(true),
        )
        .addIntegerOption((option) =>
          option.setName('delta').setDescription('TC delta (can be negative)').setRequired(true),
        )
        .addStringOption((option) =>
          option.setName('reason').setDescription('Reason').setRequired(true),
        ),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

  report = new SlashCommandBuilder()
    .setName('report')
    .setDescription('Generate reports')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('weekly')
        .setDescription('Generate weekly report')
        .addStringOption((option) =>
          option.setName('cycle_id').setDescription('Cycle ID').setRequired(true),
        ),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

  rankSync = new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Manage ranks')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('sync')
        .setDescription('Sync rank for a user or all users')
        .addUserOption((option) =>
          option.setName('user').setDescription('User to sync (leave empty for all)').setRequired(false),
        ),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

  awardDeliveredFeatures = new SlashCommandBuilder()
    .setName('award')
    .setDescription('Award delivered features points (exempt from 200 TC cap)')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('delivered')
        .setDescription('Award points to multiple users for delivered features')
        .addStringOption((option) =>
          option
            .setName('identifiers')
            .setDescription('Comma-separated Discord IDs or emails (e.g. 123,456 or user@mail.com)')
            .setRequired(true),
        )
        .addIntegerOption((option) =>
          option
            .setName('points')
            .setDescription('TC points per user')
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName('reason')
            .setDescription('Reason for awarding points (e.g. "Video Session", "Playtime", etc.)')
            .setRequired(true),
        ),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

  sheetsSync = new SlashCommandBuilder()
    .setName('sheets')
    .setDescription('Synchronize Google Sheets with database')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('sync')
        .setDescription('Manually trigger Google Sheets synchronization'),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

  async handleLaunchBuild(interaction: ChatInputCommandInteraction) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({
        content: '❌ You must be an administrator to use this command.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const buildName = interaction.options.getString('build_name', true);
    const appStoreLink = interaction.options.getString('app_store_link', true);
    const googlePlayLink = interaction.options.getString('google_play_link', true);

    const build = await this.cycleService.launchNewBuild({
      buildVersion: buildName,
      appStoreLink,
      googlePlayLink,
      createdBy: interaction.user.id,
    });

    const announcementsChannelId = this.configService.get(
      'discord.channels.announcements',
    );
    if (announcementsChannelId) {
      const embed = new EmbedBuilder()
        .setTitle('🚀 New Build Launched!')
        .setDescription(
          `**${buildName}** is now live!\n\n` +
            'Download the build and start testing. Use `/participate` to submit your contributions.\n\n' +
            'Each tester can earn up to **200 TC** per build from regular submissions. ' +
            'Award bonus points for any delivered feature or milestone. Points are exempt from the 200 TC per build cap.',
        )
        .setColor(0x57f287)
        .addFields(
          {
            name: '📱 App Store',
            value: `[Download](${appStoreLink})`,
            inline: true,
          },
          {
            name: '🤖 Google Play',
            value: `[Download](${googlePlayLink})`,
            inline: true,
          },
          {
            name: '📅 Build Start',
            value: build.weekStart.toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            }),
            inline: false,
          },
        )
        .setFooter({
          text: 'Use /participate for submission links • Use /founders profile to check your TC',
        })
        .setTimestamp();

      await this.discordService.sendEmbedToChannel(
        announcementsChannelId,
        embed,
      );
    }

    await interaction.editReply({
      content: `✅ Build **${buildName}** launched! Previous build closed. Announcement sent.`,
    });
  }

  async handleAwardDeliveredFeatures(interaction: ChatInputCommandInteraction) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({
        content: '❌ You must be an administrator to use this command.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const identifiersStr = interaction.options.getString('identifiers', true);
    const points = interaction.options.getInteger('points', true);
    const reason = interaction.options.getString('reason', true);

    const identifiers = identifiersStr
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (identifiers.length === 0) {
      await interaction.editReply({
        content: '❌ Please provide at least one Discord ID or email.',
      });
      return;
    }

    // Resolve identifiers (Discord ID or email) to discord_user_id - ensure player exists
    const discordUserIds: string[] = [];
    const unresolved: string[] = [];

    for (const identifier of identifiers) {
      const isEmail = identifier.includes('@');
      let discordId: string | null = null;

      if (isEmail) {
        discordId = await this.playerService.resolveToDiscordId(
          identifier,
          identifier,
          true, // createIfMissing - creates temp player with email
        );
      } else {
        // Discord ID - ensure player exists in DB
        const player = await this.playerService.getPlayer(identifier);
        if (player) {
          discordId = identifier;
        } else {
          await this.playerService.upsertPlayer(
            identifier,
            'Unknown',
            undefined,
            undefined,
            undefined,
          );
          discordId = identifier;
        }
      }

      if (discordId) {
        discordUserIds.push(discordId);
      } else {
        unresolved.push(identifier);
      }
    }

    if (unresolved.length > 0) {
      await interaction.editReply({
        content:
          `❌ Could not resolve: ${unresolved.join(', ')}\n` +
          '(Email must exist in players from form submissions, or use valid Discord ID)',
      });
      return;
    }

    const payload: Record<string, any> = {
      reason: reason,
      awardedBy: interaction.user.id,
    };

    // Use 'video_session' as default type for delivered features (exempt from cap)
    // The actual reason is stored in payload.reason
    const submissions = await this.submissionService.awardDeliveredFeatures(
      discordUserIds,
      'video_session', // Default type for delivered features
      points,
      payload,
      undefined,
      interaction.user.id,
    );

    // Send individual message to highlights channel for each user
    const highlightsChannelId = this.configService.get('discord.channels.highlights');
    const sentMessages: string[] = [];
    const failedMessages: string[] = [];

    if (highlightsChannelId) {
      for (const discordUserId of discordUserIds) {
        // Skip temp users (they don't have Discord accounts)
        if (discordUserId.startsWith('temp_')) {
          failedMessages.push(discordUserId);
          continue;
        }

        const message = `🎉 Player <@${discordUserId}> received **${points} TC** for **${reason}**. Thank you for your contribution!`;

        try {
          await this.discordService.sendToChannel(highlightsChannelId, message);
          sentMessages.push(discordUserId);
        } catch (error) {
          console.error(`Failed to send highlights message for user ${discordUserId}:`, error);
          failedMessages.push(discordUserId);
        }
      }
    }

    // Build response for admin
    const successMentions = sentMessages.map((id) => `<@${id}>`);
    const failedMentions = failedMessages.map((id) =>
      id.startsWith('temp_') ? id : `<@${id}>`,
    );

    let responseContent = `✅ Awarded **${points} TC** (${reason}) to **${submissions.length}** user(s).\n\n`;

    if (sentMessages.length > 0) {
      responseContent += `📢 **Highlights message sent for ${sentMessages.length} user(s):**\n${successMentions.join(', ')}\n\n`;
    }

    if (failedMessages.length > 0) {
      responseContent += `⚠️ **Could not send highlights message for ${failedMessages.length} user(s):**\n${failedMentions.join(', ')}\n`;
      responseContent += `(May be temp accounts or channel not configured)`;
    }

    await interaction.editReply({
      content: responseContent,
    });
  }

  async handleShipped(interaction: ChatInputCommandInteraction) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({
        content: '❌ You must be an administrator to use this command.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const user = interaction.options.getUser('user', true);
    const publicMessage = interaction.options.getString('public_message', true);
    const userId = user.id;

    // Create shipped bonus submission
    const shippedSubmission = await this.submissionService.createSubmission(
      userId,
      'shipped_bonus',
      { publicMessage },
      [],
      undefined,
      'approved',
    );

    // Post to highlights channel
    const highlightsChannelId = this.configService.get(
      'discord.channels.highlights',
    );
    if (highlightsChannelId) {
      const message = `✅ **SHIPPED:** <@${userId}> - ${publicMessage}`;
      await this.discordService.sendToChannel(highlightsChannelId, message);
    }

    await interaction.editReply({
      content: `✅ Shipped bonus awarded! +100 TC to <@${userId}>`,
    });
  }

  async handleTcAdjust(interaction: ChatInputCommandInteraction) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({
        content: '❌ You must be an administrator to use this command.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const user = interaction.options.getUser('user', true);
    const delta = interaction.options.getInteger('delta', true);
    const reason = interaction.options.getString('reason', true);

    await this.playerService.upsertUser(user.id, user.username, user.displayName || undefined);

    await this.submissionService.createManualAdjustment(
      user.id,
      delta,
      reason,
      interaction.user.id,
    );

    await interaction.editReply({
      content: `✅ TC adjusted: ${delta > 0 ? '+' : ''}${delta} TC for <@${user.id}>\nReason: ${reason}`,
    });
  }

  async handleReportWeekly(interaction: ChatInputCommandInteraction) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({
        content: '❌ You must be an administrator to use this command.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: false });

    const cycleId = interaction.options.getString('cycle_id', true);
    const leaderboard = await this.submissionService.getLeaderboard(
      'week',
      cycleId,
      10,
    );

    const cycle = await this.cycleService.getCycle(cycleId);

    const embed = new EmbedBuilder()
      .setTitle(`📊 Weekly Report - ${cycle?.buildVersion || cycleId}`)
      .setColor(0x5865f2)
      .setDescription(
        leaderboard.length > 0
          ? leaderboard
              .map(
                (entry, index) =>
                  `${index + 1}. **${entry.username}** - ${entry.totalTc} TC`,
              )
              .join('\n')
          : 'No submissions this week.',
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }

  async handleRankSync(interaction: ChatInputCommandInteraction) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({
        content: '❌ You must be an administrator to use this command.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const user = interaction.options.getUser('user');
    const guild = await this.discordService.getGuild();

    if (user) {
      // Sync single user
      const tester = await this.testerArmyService.getTester(user.id);
      if (!tester) {
        await interaction.editReply({
          content: `❌ User <@${user.id}> is not a member of the Tester Army.`,
        });
        return;
      }

      const oldRank = tester.currentRank;
      const newRank = await this.rankService.evaluateRank(user.id);
      await this.rankService.syncDiscordRoles(user.id, guild);

      if (oldRank !== newRank) {
        await interaction.editReply({
          content: `✅ Rank synced for <@${user.id}>: ${oldRank} → ${newRank}`,
        });
      } else {
        await interaction.editReply({
          content: `✅ Rank synced for <@${user.id}>: ${newRank} (no change)`,
        });
      }
    } else {
      // Sync all active testers
      const testers = await this.testerArmyService.getAllActiveTesters();
      let synced = 0;
      let changed = 0;

      await interaction.editReply({
        content: `🔄 Syncing ranks for ${testers.length} testers...`,
      });

      for (const tester of testers) {
        try {
          const oldRank = tester.currentRank;
          const newRank = await this.rankService.evaluateRank(tester.discordUserId);
          await this.rankService.syncDiscordRoles(tester.discordUserId, guild);
          synced++;
          if (oldRank !== newRank) {
            changed++;
          }
        } catch (error) {
          console.error(`Error syncing rank for ${tester.discordUserId}:`, error);
        }
      }

      await interaction.editReply({
        content: `✅ Rank sync complete!\n- Synced: ${synced} testers\n- Changed: ${changed} ranks`,
      });
    }
  }

  async handleSheetsSync(interaction: ChatInputCommandInteraction) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({
        content: '❌ You must be an administrator to use this command.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      await interaction.editReply({
        content: '🔄 Synchronizing Google Sheets with database...\n\nThis may take a moment...',
      });

      // Trigger manual sync (resets last processed row and processes all rows)
      await this.googleSheetsService.manualSync();

      const embed = new EmbedBuilder()
        .setTitle('✅ Synchronization Complete')
        .setColor(0x57f287)
        .setDescription(
          'Google Sheets has been synchronized with the database.\n\n' +
          'All rows have been processed:\n' +
          '• New submissions have been created\n' +
          '• Existing submissions have been updated if QA status changed\n' +
          '• Points have been awarded based on QA status',
        )
        .setTimestamp();

      await interaction.editReply({
        content: '',
        embeds: [embed],
      });
    } catch (error) {
      console.error('Error syncing Google Sheets:', error);
      
      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Synchronization Failed')
        .setColor(0xed4245)
        .setDescription(
          `An error occurred while synchronizing Google Sheets:\n\n` +
          `\`\`\`${error instanceof Error ? error.message : 'Unknown error'}\`\`\``,
        )
        .setTimestamp();

      await interaction.editReply({
        content: '',
        embeds: [errorEmbed],
      });
    }
  }
}
