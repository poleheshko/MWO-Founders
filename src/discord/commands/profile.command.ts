import { Injectable } from '@nestjs/common';
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import { TesterArmyService } from '../../tester-army/tester-army.service';
import { SubmissionService } from '../../submission/submission.service';
import { PlayerService } from '../../player/player.service';
import { RankService } from '../../rank/rank.service';
import { DiscordService } from '../discord.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ProfileCommand {
  private readonly programRoles: string[];

  constructor(
    private readonly testerArmyService: TesterArmyService,
    private readonly submissionService: SubmissionService,
    private readonly playerService: PlayerService,
    private readonly rankService: RankService,
    private readonly discordService: DiscordService,
    private readonly configService: ConfigService,
  ) {
    this.programRoles = this.configService.get('program.roles') || [];
  }

  data = new SlashCommandBuilder()
    .setName('founders')
    .setDescription('Founders Circle commands')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('profile')
        .setDescription('View your Tester Army profile'),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('add-email')
        .setDescription('Add your email (required to use all commands)')
        .addStringOption((option) =>
          option
            .setName('email')
            .setDescription('Your email (same as in submission forms)')
            .setRequired(true),
        ),
    );

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const subcommand = interaction.options.getSubcommand();

      if (subcommand === 'add-email') {
        await this.handleAddEmail(interaction);
        return;
      }

      if (subcommand !== 'profile') {
        await interaction.editReply({
          content: '❌ Unknown subcommand',
        });
        return;
      }

      const discordUserId = interaction.user.id;
      const discordUsername = interaction.user.username;
      const displayName = 
        interaction.member && 'displayName' in interaction.member
          ? interaction.member.displayName
          : null;

      // First check if tester exists
      let tester;
      try {
        tester = await this.testerArmyService.getTester(discordUserId);
      } catch (testerError) {
        console.error('Error getting tester:', testerError);
        throw testerError;
      }

      // If tester doesn't exist, check if user has program role
      if (!tester) {
        // Check if user has any program role in Discord
        let memberRoles: string[] = [];
        if (interaction.member) {
          // Check if member is a GuildMember (has roles.cache) or APIInteractionGuildMember (has roles as string[])
          if ('roles' in interaction.member) {
            const roles = interaction.member.roles;
            if (Array.isArray(roles)) {
              // APIInteractionGuildMember - roles is string[]
              memberRoles = roles;
            } else if (roles && typeof roles === 'object' && 'cache' in roles) {
              // GuildMember - roles is GuildMemberRoleManager
              memberRoles = (roles as any).cache.map((r: any) => r.name);
            }
          }
        }
        
        const hasProgramRole = memberRoles.some((role) =>
          this.programRoles.includes(role),
        );

        if (!hasProgramRole) {
          // User doesn't have program role and is not registered
          await interaction.editReply({
            content:
              '⚠️ You are not a member of the Tester Army. Join the program to see your profile!\n\n📝 Join here: https://docs.google.com/forms/d/e/1FAIpQLSes_BYNWA3ICKtaBUSfGODw7sE5jqEQDEequF0TQQNUANu-3g/viewform?usp=sharing&ouid=105415417568017069950',
          });
          return;
        }

        // User has program role but not registered - sync membership
        try {
          await this.testerArmyService.syncMembership(
            discordUserId,
            discordUsername,
            displayName,
            memberRoles,
          );
          tester = await this.testerArmyService.getTester(discordUserId);
        } catch (syncError) {
          console.error('Error syncing membership:', syncError);
          await interaction.editReply({
            content:
              '⚠️ You are not a member of the Tester Army. Join the program to see your profile!\n\n📝 Join here: https://docs.google.com/forms/d/e/1FAIpQLSes_BYNWA3ICKtaBUSfGODw7sE5jqEQDEequF0TQQNUANu-3g/viewform?usp=sharing&ouid=105415417568017069950',
          });
          return;
        }
      }

      // Now update player info (only if tester exists)
      let player;
      if (tester) {
        try {
          await this.playerService.upsertUser(
            discordUserId,
            discordUsername,
            displayName || undefined,
          );
          player = await this.playerService.getPlayer(discordUserId);
        } catch (playerError) {
          console.error('Error upserting player:', playerError);
        }
      }

      // Require email to use commands - must match form submissions
      if (!player?.email || !player.email.includes('@')) {
        await interaction.editReply({
          content:
            '⚠️ **Email required**\n\n' +
            'To use Founders Circle commands, you must set your email first.\n' +
            'Use `/founders add-email` with the **same email** you use in the submission forms.\n\n' +
            'This links your Discord account to your form submissions.',
        });
        return;
      }

      // Re-evaluate rank based on current TC before displaying profile
      try {
        await this.rankService.evaluateRank(discordUserId);
        // Refresh tester data after rank evaluation
        tester = await this.testerArmyService.getTester(discordUserId);
        if (tester) {
          // Sync Discord roles if rank changed
          const guild = await this.discordService.getGuild();
          await this.rankService.syncDiscordRoles(discordUserId, guild);
        }
      } catch (rankError) {
        console.error('Error evaluating rank:', rankError);
        // Continue even if rank evaluation fails
      }

      // Get submissions by status
      let pendingSubmissions: any[] = [];
      let declinedSubmissions: any[] = [];
      let confirmedSubmissions: any[] = [];
      let allDeclinedSubmissions: any[] = [];

      try {
        pendingSubmissions = await this.submissionService.getSubmissionsByUser(
          discordUserId,
          5,
          'pending',
        );
        declinedSubmissions = await this.submissionService.getSubmissionsByUser(
          discordUserId,
          5,
          'declined',
        );
        confirmedSubmissions = await this.submissionService.getSubmissionsByUser(
          discordUserId,
          15,
          'approved',
        );
        // Get all declined submissions to calculate total declined TC
        allDeclinedSubmissions = await this.submissionService.getSubmissionsByUser(
          discordUserId,
          1000, // Large limit to get all declined submissions
          'declined',
        );
      } catch (submissionsError) {
        console.error('Error getting submissions:', submissionsError);
        throw submissionsError;
      }

      const rankDisplayNames: Record<string, string> = {
        recruit: 'Tester Recruit',
        explorer: 'Explorer',
        test_pilot: 'Test Pilot',
        founders_circle: 'Founders Circle',
      };

      const submissionTypeNames: Record<string, string> = {
        quick_test: 'Quick Test',
        survey: 'Survey',
        screenshot: 'Bug with screenshot',
        bug_repro: 'Bug Reproduction',
        bug_video: 'Bug Video',
        balance_analysis: 'Balance Analysis',
        retest: 'Re-test',
        shipped_bonus: 'Shipped Bonus',
        manual_adjust: 'Manual Adjust',
        structured_report_bonus: 'Structured Report Bonus',
        video_session: 'Video Session',
        playtime_minimum: 'Playtime (min 5 minutes)',
      };

      // Helper function to get display name for submission
      const getSubmissionDisplayName = (s: any): string => {
        // Check if this is a structured report build submission
        if (s.payloadJson?.structuredReportBuild && s.payloadJson?.buildVersion) {
          return `Structured Report ${s.payloadJson.buildVersion}`;
        }
        // Check if this is a Record your session submission
        if (s.payloadJson?.recordSession) {
          return 'Record your session';
        }
        return submissionTypeNames[s.type] || s.type;
      };

      const formatDate = (d: Date) =>
        new Date(d).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });

      // Calculate declined TC from all declined submissions
      const declinedTc = allDeclinedSubmissions.reduce(
        (sum, s) => sum + (s.tcProposed || 0),
        0,
      );

      const embed = new EmbedBuilder()
        .setTitle(`👋 ${displayName || interaction.user.username}'s Profile`)
        .setColor(0x5865f2)
        .addFields(
          {
            name: '✅ Confirmed TC',
            value: tester.tcConfirmedTotal.toString(),
            inline: true,
          },
          {
            name: '⏳ Pending TC',
            value: tester.tcPendingTotal.toString(),
            inline: true,
          },
          {
            name: '❌ Declined TC',
            value: declinedTc.toString(),
            inline: true,
          },
          {
            name: '🎖️ Rank',
            value: rankDisplayNames[tester.currentRank] || tester.currentRank,
            inline: true,
          },
          {
            name: '📧 Email',
            value: player?.email || '❌ Not set',
            inline: true,
          },
        );

      // Recent Submissions (pending)
      const pendingList =
        pendingSubmissions.length > 0
          ? pendingSubmissions
              .map(
                (s) =>
                  `• **${getSubmissionDisplayName(s)}** (${s.status}) - ${s.tcProposed} TC — ${formatDate(s.createdAt)}`,
              )
              .join('\n')
          : '_No pending submissions_';
      embed.addFields({
        name: '📝 Recent Submissions',
        value: pendingList.substring(0, 1024),
      });

      // Confirmed Submissions (includes bug_repro, award delivered: structured_report_bonus, video_session, playtime_minimum)
      const confirmedList =
        confirmedSubmissions.length > 0
          ? confirmedSubmissions
              .map(
                (s) =>
                  `• **${getSubmissionDisplayName(s)}** — +${s.tcAwarded} TC — ${formatDate(s.createdAt)}`,
              )
              .join('\n')
          : '_No confirmed submissions yet_';
      embed.addFields({
        name: '✅ Confirmed Submissions',
        value: confirmedList.substring(0, 1024),
      });

      // Declined Submissions
      const declinedList =
        declinedSubmissions.length > 0
          ? declinedSubmissions
              .map(
                (s) =>
                  `• **${getSubmissionDisplayName(s)}** — ${s.tcProposed} TC — ${formatDate(s.createdAt)}`,
              )
              .join('\n')
          : '_No declined submissions_';
      embed.addFields({
        name: '❌ Declined Submissions',
        value: declinedList.substring(0, 1024),
      });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in profile command:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({
            content: `❌ An error occurred while fetching your profile. Please try again later.\n\nError: ${error instanceof Error ? error.message : 'Unknown error'}`,
          });
        } else {
          await interaction.reply({
            content: `❌ An error occurred while fetching your profile. Please try again later.\n\nError: ${error instanceof Error ? error.message : 'Unknown error'}`,
            ephemeral: true,
          });
        }
      } catch (replyError) {
        console.error('Error sending error message:', replyError);
      }
    }
  }

  private async handleAddEmail(interaction: ChatInputCommandInteraction) {
    try {
      const discordUserId = interaction.user.id;
      const email = interaction.options.getString('email', true);

      if (!email || !email.includes('@')) {
        await interaction.editReply({
          content: '❌ Please provide a valid email address.',
        });
        return;
      }

      // Merge any player with same email (e.g. temp_ from forms) into this Discord ID
      const { merged } = await this.playerService.mergePlayerByEmail(
        discordUserId,
        email,
      );
      if (merged) {
        await this.submissionService.recalculateTotals(discordUserId);
      }

      // Get or create player
      let player = await this.playerService.getPlayer(discordUserId);
      if (!player) {
        const discordUsername = interaction.user.username;
        const displayName = 
          interaction.member && 'displayName' in interaction.member
            ? interaction.member.displayName
            : null;
        await this.playerService.upsertPlayer(
          discordUserId,
          discordUsername,
          displayName || undefined,
          undefined,
          email,
        );
        player = await this.playerService.getPlayer(discordUserId);
      }

      if (!player) {
        await interaction.editReply({
          content: '❌ Failed to create or retrieve player profile',
        });
        return;
      }

      const oldEmail = player.email;
      const updatedPlayer = await this.playerService.updatePlayerFields(
        discordUserId,
        undefined,
        email,
      );

      if (!updatedPlayer) {
        await interaction.editReply({
          content: '❌ Failed to update player profile',
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('✅ Email Set')
        .setColor(0x00ff00)
        .setDescription(
          updatedPlayer.email !== oldEmail
            ? `**Email:** ${updatedPlayer.email}\n\nUse the **same email** in the submission forms to link your submissions.`
            : 'Email unchanged.',
        )
        .setFooter({ text: 'Use /founders profile to view your profile' });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in add-email command:', error);
      await interaction.editReply({
        content: `❌ An error occurred while updating your profile.\n\nError: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }
}
