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
import { GoogleSheetsService } from '../../google-sheets/google-sheets.service';

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
    private readonly googleSheetsService: GoogleSheetsService,
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

      // Re-evaluate rank based on current gems before displaying profile
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

      // Sync from all configured sheets (2.11, 2.12, …) so profile shows latest All-in-One data
      try {
        await this.googleSheetsService.syncForUserByEmail(player.email);
        await this.submissionService.recalculateTotals(discordUserId);
        tester = await this.testerArmyService.getTester(discordUserId);
        if (tester) {
          const guild = await this.discordService.getGuild();
          await this.rankService.syncDiscordRoles(discordUserId, guild);
        }
      } catch (syncErr) {
        console.error('Error syncing sheets for profile:', syncErr);
        // Continue showing profile with existing DB data
      }

      // Get submissions by status
      let pendingSubmissions: any[] = [];
      let declinedSubmissions: any[] = [];
      let confirmedSubmissions: any[] = [];
      let allDeclinedSubmissions: any[] = [];

      try {
        // Max 10 items per section (order: newest first / descending)
        pendingSubmissions = await this.submissionService.getSubmissionsByUser(
          discordUserId,
          10,
          'pending',
        );
        declinedSubmissions = await this.submissionService.getSubmissionsByUser(
          discordUserId,
          10,
          'declined',
        );
        confirmedSubmissions = await this.submissionService.getSubmissionsByUser(
          discordUserId,
          10,
          'approved',
        );
        // Get all declined submissions to calculate total declined gems
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
        // All-in-one form (one long form per build)
        if (s.payloadJson?.allInOneForm && s.payloadJson?.buildVersion) {
          return `All-in-One (Build ${s.payloadJson.buildVersion})`;
        }
        // Structured report build submission
        if (s.payloadJson?.structuredReportBuild && s.payloadJson?.buildVersion) {
          return `Structured Report ${s.payloadJson.buildVersion}`;
        }
        // Record your session submission
        if (s.payloadJson?.recordSession) {
          return 'Record your session';
        }
        return submissionTypeNames[s.type] || s.type;
      };

      // For All-in-One: breakdown text (e.g. " _(400 First Session + 100 form)_")
      const getAllInOneBreakdown = (s: any): string => {
        if (!s.payloadJson?.allInOneForm) return '';
        const fsr = s.payloadJson.fsrGems ?? 0;
        const form = s.payloadJson.formGems ?? 0;
        if (fsr === 0 && form === 0) return '';
        const parts: string[] = [];
        if (fsr > 0) parts.push(`${fsr} First Session`);
        if (form > 0) parts.push(`${form} form`);
        return parts.length ? ` _(${parts.join(' + ')})_` : '';
      };

      // All-in-One: zwraca punkty per kolumna (tylko niezerowe). Nowy format: ifPerColumn/sPerColumn/vPerColumn/srPerColumn; stary: ifGems/sGems/vGems/srGems.
      const getAllInOnePerColumn = (p: any): { fsr: number; feedback: number[]; images: number[]; video: number[]; structured: number[] } => {
        const fsr = p?.fsrGems ?? 0;
        const feedback = Array.isArray(p?.ifPerColumn) ? (p.ifPerColumn as number[]).filter((n) => n > 0) : (p?.ifGems > 0 ? [p.ifGems] : []);
        const images = Array.isArray(p?.sPerColumn) ? (p.sPerColumn as number[]).filter((n) => n > 0) : (p?.sGems > 0 ? [p.sGems] : []);
        const video = Array.isArray(p?.vPerColumn) ? (p.vPerColumn as number[]).filter((n) => n > 0) : (p?.vGems > 0 ? [p.vGems] : []);
        const structured = Array.isArray(p?.srPerColumn) ? (p.srPerColumn as number[]).filter((n) => n > 0) : (p?.srGems > 0 ? [p.srGems] : []);
        return { fsr, feedback, images, video, structured };
      };

      const formatDate = (d: Date) =>
        new Date(d).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });

      // Calculate declined gems:
      // - all submissions (including All-in-One): use tcProposed (already includes per-form caps)
      const declinedTc = allDeclinedSubmissions.reduce((sum, s) => {
        return sum + (s.tcProposed || 0);
      }, 0);

      const gem = this.discordService.getGemEmoji();

      const embed = new EmbedBuilder()
        .setTitle(`👋 ${displayName || interaction.user.username}'s Profile`)
        .setColor(0x5865f2)
        .addFields(
          {
            name: `✅ Confirmed ${gem}`,
            value: tester.tcConfirmedTotal.toString(),
            inline: true,
          },
          {
            name: `⏳ Pending ${gem}`,
            value: tester.tcPendingTotal.toString(),
            inline: true,
          },
          {
            name: `❌ Declined ${gem}`,
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

      // Recent Submissions (pending) – All-in-One rozbite na First Session / Feedback / Images / Videos / Structured
      const pendingLines: string[] = [];
      for (const s of pendingSubmissions) {
        const name = getSubmissionDisplayName(s);
        const dateStr = formatDate(s.createdAt);

        if (s.payloadJson?.allInOneForm) {
          const { fsr, feedback, images, video, structured } = getAllInOnePerColumn(s.payloadJson);
          const hasAny = fsr > 0 || feedback.length > 0 || images.length > 0 || video.length > 0 || structured.length > 0;
          if (!hasAny) {
            pendingLines.push(
              `• **${name}** (${s.status}) - ${s.tcProposed} ${gem} — ${dateStr}`,
            );
          } else {
            if (fsr > 0) {
              pendingLines.push(
                `• **${name} - First Session** (pending) - ${fsr} ${gem} — ${dateStr}`,
              );
            }
            for (const val of feedback) {
              pendingLines.push(
                `• **${name} - Feedback** (pending) - ${val} ${gem} — ${dateStr}`,
              );
            }
            for (const val of images) {
              pendingLines.push(
                `• **${name} - Images** (pending) - ${val} ${gem} — ${dateStr}`,
              );
            }
            for (const val of video) {
              pendingLines.push(
                `• **${name} - Videos** (pending) - ${val} ${gem} — ${dateStr}`,
              );
            }
            for (const val of structured) {
              pendingLines.push(
                `• **${name} - Structured** (pending) - ${val} ${gem} — ${dateStr}`,
              );
            }
          }
        } else {
          pendingLines.push(
            `• **${name}** (${s.status}) - ${s.tcProposed} ${gem} — ${dateStr}`,
          );
        }
      }
      const pendingList =
        pendingLines.length > 0
          ? pendingLines.slice(0, 10).join('\n')
          : '_No pending submissions_';
      embed.addFields({
        name: '📝 Recent Submissions _(last 10)_',
        value: pendingList.substring(0, 1024),
      });

      // Confirmed Submissions (includes bug_repro, delivered features, All-in-One, etc.)
      const confirmedLines: string[] = [];

      for (const s of confirmedSubmissions) {
        const name = getSubmissionDisplayName(s);
        const dateStr = formatDate(s.createdAt);

        if (s.payloadJson?.allInOneForm) {
          const { fsr, feedback, images, video, structured } = getAllInOnePerColumn(s.payloadJson);
          const hasAny = fsr > 0 || feedback.length > 0 || images.length > 0 || video.length > 0 || structured.length > 0;
          if (!hasAny) {
            confirmedLines.push(
              `• **${name}** — +${s.tcAwarded} ${gem} — ${dateStr}`,
            );
          } else {
            if (fsr > 0) {
              confirmedLines.push(
                `• **${name} - First Session** — +${fsr} ${gem} — ${dateStr}`,
              );
            }
            for (const val of feedback) {
              confirmedLines.push(
                `• **${name} - Feedback** — +${val} ${gem} — ${dateStr}`,
              );
            }
            for (const val of images) {
              confirmedLines.push(
                `• **${name} - Images** — +${val} ${gem} — ${dateStr}`,
              );
            }
            for (const val of video) {
              confirmedLines.push(
                `• **${name} - Videos** — +${val} ${gem} — ${dateStr}`,
              );
            }
            for (const val of structured) {
              confirmedLines.push(
                `• **${name} - Structured** — +${val} ${gem} — ${dateStr}`,
              );
            }
          }
        } else {
          confirmedLines.push(
            `• **${name}** — +${s.tcAwarded} ${gem} — ${dateStr}`,
          );
        }
      }

      const confirmedList =
        confirmedLines.length > 0
          ? confirmedLines.slice(0, 10).join('\n')
          : '_No confirmed submissions yet_';
      embed.addFields({
        name: '✅ Confirmed Submissions _(last 10)_',
        value: confirmedList.substring(0, 1024),
      });

      // Declined Submissions (All-in-One także rozbite na części)
      const declinedLines: string[] = [];
      for (const s of declinedSubmissions) {
        const name = getSubmissionDisplayName(s);
        const dateStr = formatDate(s.createdAt);

        if (s.payloadJson?.allInOneForm) {
          const { fsr, feedback, images, video, structured } = getAllInOnePerColumn(s.payloadJson);
          const hasAny = fsr > 0 || feedback.length > 0 || images.length > 0 || video.length > 0 || structured.length > 0;
          if (!hasAny) {
            declinedLines.push(
              `• **${name}** — ${s.tcProposed} ${gem} — ${dateStr}`,
            );
          } else {
            if (fsr > 0) {
              declinedLines.push(
                `• **${name} - First Session** — ${fsr} ${gem} — ${dateStr}`,
              );
            }
            for (const val of feedback) {
              declinedLines.push(
                `• **${name} - Feedback** — ${val} ${gem} — ${dateStr}`,
              );
            }
            for (const val of images) {
              declinedLines.push(
                `• **${name} - Images** — ${val} ${gem} — ${dateStr}`,
              );
            }
            for (const val of video) {
              declinedLines.push(
                `• **${name} - Videos** — ${val} ${gem} — ${dateStr}`,
              );
            }
            for (const val of structured) {
              declinedLines.push(
                `• **${name} - Structured** — ${val} ${gem} — ${dateStr}`,
              );
            }
          }
        } else {
          declinedLines.push(
            `• **${name}** — ${s.tcProposed} ${gem} — ${dateStr}`,
          );
        }
      }

      const declinedList =
        declinedLines.length > 0
          ? declinedLines.slice(0, 10).join('\n')
          : '_No declined submissions_';
      embed.addFields({
        name: '❌ Declined Submissions _(last 10)_',
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
