import { Injectable } from '@nestjs/common';
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ButtonInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { ConfigService } from '@nestjs/config';
import { PlayerService } from '../../player/player.service';
import { DiscordService } from '../discord.service';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { parse as dotenvParse } from 'dotenv';

@Injectable()
export class ParticipateCommand {
  constructor(
    private readonly configService: ConfigService,
    private readonly playerService: PlayerService,
    private readonly discordService: DiscordService,
  ) {}

  data = new SlashCommandBuilder()
    .setName('participate')
    .setDescription('Get links to submit your contributions');

  /** Fallback: load FORM_* vars from .env file when process.env doesn't have them (e.g. Nest watch child process). */
  private loadFormUrlsFromEnvFile(): Record<string, string> | null {
    const paths = [
      resolve(process.cwd(), '.env'),
      resolve(process.cwd(), '..', '.env'),
    ];
    for (const envPath of paths) {
      if (!existsSync(envPath)) continue;
      try {
        const raw = readFileSync(envPath, 'utf8');
        const parsed = dotenvParse(raw);
        const formVars: Record<string, string> = {};
        for (const [k, v] of Object.entries(parsed)) {
          if (k.startsWith('FORM_') && typeof v === 'string' && v.trim()) formVars[k] = v.trim();
        }
        if (Object.keys(formVars).length > 0) {
          console.log('[Participate] Loaded FORM_* from .env file:', envPath, Object.keys(formVars));
          return formVars;
        }
      } catch (e) {
        // ignore
      }
    }
    return null;
  }

  async execute(interaction: ChatInputCommandInteraction) {
    console.log('=== Participate command executed ===');
    let deferred = false;
    
    try {
      console.log('Attempting to defer reply...');
      await interaction.deferReply({ ephemeral: true });
      deferred = true;
      console.log('Reply deferred successfully');

      const player = await this.playerService.getPlayer(interaction.user.id);
      if (!player?.email || !player.email.includes('@')) {
        await interaction.editReply({
          content:
            '⚠️ **Email required**\n\nUse `/founders add-email` to set your email first (same as in the submission forms). Then you can access these links.',
        });
        return;
      }

      const gem = this.discordService.getGemEmoji();

      const currentAllInOne = this.getCurrentAllInOneAllBuildLink();

      let description =
        `Current contribution types and rewards in ${gem} gems:\n` +
        `• 🎥 Bug with video – 40 ${gem}\n` +
        `• 📸 Bug with screenshot – 5 ${gem}\n` +
        `• 🧩 Issue feedback – varies\n` +
        `• 📊 Structured report – up to 250 ${gem} (based on QA and points assigned)\n` +
        `• 🕹️ First Session Record – 400 ${gem}\n\n`;

      if (currentAllInOne) {
        description += `**Current All‑in‑One form for build ${currentAllInOne.version}:**\n${currentAllInOne.formUrl}`;
      } else {
        description +=
          '⚠️ All‑in‑One form for the current build is not configured yet. Please contact an administrator.';
      }

      const embed = new EmbedBuilder()
        .setTitle('🎯 Participate in Tester Army')
        .setDescription(description)
        .setColor(0x5865f2);

      const replyOptions: any = {
        embeds: [embed],
      };

      console.log('\n=== Sending Reply ===');
      console.log('Reply options:', {
        hasEmbeds: replyOptions.embeds?.length > 0,
        hasComponents: replyOptions.components?.length > 0,
        componentCount: replyOptions.components?.length || 0,
      });

      try {
        await interaction.editReply(replyOptions);
        console.log('✅ Reply sent successfully');
      } catch (replyError) {
        console.error('Error editing reply:', replyError);
        // Fallback: try to send a simple message
        await interaction.editReply({
          content: '❌ Unable to display participation links. Please contact an administrator.',
          embeds: [],
        });
      }
    } catch (error) {
      console.error('=== ERROR in participate command ===');
      console.error('Error details:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
      console.error('Deferred:', deferred);
      console.error('Interaction deferred:', interaction.deferred);
      console.error('Interaction replied:', interaction.replied);
      
      try {
        if (deferred || interaction.deferred || interaction.replied) {
          console.log('Trying to edit reply...');
          await interaction.editReply({
            content: '❌ An error occurred while fetching participation links. Please try again later.',
          });
          console.log('Error message sent via editReply');
        } else {
          console.log('Trying to reply...');
          await interaction.reply({
            content: '❌ An error occurred while fetching participation links. Please try again later.',
            ephemeral: true,
          });
          console.log('Error message sent via reply');
        }
      } catch (replyError) {
        console.error('=== CRITICAL: Failed to send error message ===');
        console.error('Reply error:', replyError);
        // Last resort - try followUp
        try {
          await interaction.followUp({
            content: '❌ An error occurred. Please contact an administrator.',
            ephemeral: true,
          });
        } catch (followUpError) {
          console.error('Even followUp failed:', followUpError);
        }
      }
    }
  }

  async handleAllInOneBuildSelection(interaction: ButtonInteraction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const player = await this.playerService.getPlayer(interaction.user.id);
      if (!player?.email || !player.email.includes('@')) {
        await interaction.editReply({
          content:
            '⚠️ **Email required**\n\nUse `/founders add-email` to set your email first (same as in the submission forms).',
        });
        return;
      }

      const allInOneBuilds = this.configService.get<Array<{ version: string; formUrl: string }>>('forms.allInOneBuilds') || [];
      if (allInOneBuilds.length === 0) {
        await interaction.editReply({
          content: '❌ All-in-One forms are not configured. Please contact an administrator.',
        });
        return;
      }

      const buildButtons: ButtonBuilder[] = allInOneBuilds
        .filter((b) => b.formUrl && b.formUrl.startsWith('http'))
        .map((build) =>
          new ButtonBuilder()
            .setLabel(`Build ${build.version} (All-in-One)`)
            .setStyle(ButtonStyle.Link)
            .setURL(build.formUrl),
        );

      if (buildButtons.length === 0) {
        await interaction.editReply({
          content: '❌ No valid All-in-One form links configured.',
        });
        return;
      }

      const row1 = new ActionRowBuilder<ButtonBuilder>();
      const row2 = new ActionRowBuilder<ButtonBuilder>();
      buildButtons.slice(0, 5).forEach((btn) => row1.addComponents(btn));
      buildButtons.slice(5, 10).forEach((btn) => row2.addComponents(btn));

      const components = [];
      if (row1.components.length > 0) components.push(row1);
      if (row2.components.length > 0) components.push(row2);

      const embed = new EmbedBuilder()
        .setTitle('📋 All-in-One Feedback – Select Build')
        .setDescription(
          'One form per build. Max **100** gems from feedback/screenshots/videos/structured answers + **400** for first session record.'
        )
        .setColor(0x5865f2)
        .setFooter({ text: 'Select a build to open the form' });

      await interaction.editReply({
        embeds: [embed],
        components,
      });
    } catch (error) {
      console.error('Error in handleAllInOneBuildSelection:', error);
      try {
        await interaction.editReply({
          content: '❌ An error occurred. Please try again later.',
        });
      } catch {
        // ignore
      }
    }
  }

  async handleStructuredReportBuildSelection(interaction: ButtonInteraction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const player = await this.playerService.getPlayer(interaction.user.id);
      if (!player?.email || !player.email.includes('@')) {
        await interaction.editReply({
          content:
            '⚠️ **Email required**\n\nUse `/founders add-email` to set your email first (same as in the submission forms).',
        });
        return;
      }

      // Get structured report form links for each build
      const buildForms = this.getStructuredReportBuildForms();
      
      if (buildForms.length === 0) {
        await interaction.editReply({
          content: '❌ Structured report forms are not configured. Please contact an administrator.',
        });
        return;
      }

      // Create buttons for each build (max 5 per row, so we need 2 rows for 8 builds)
      const buildButtons: ButtonBuilder[] = buildForms.map((build) => {
        const btn = new ButtonBuilder()
          .setLabel(`Build ${build.version}`)
          .setStyle(ButtonStyle.Link)
          .setURL(build.formUrl);
        return btn;
      });

      // Split into rows (5 buttons per row max)
      const row1 = new ActionRowBuilder<ButtonBuilder>();
      const row2 = new ActionRowBuilder<ButtonBuilder>();
      
      buildButtons.slice(0, 5).forEach(btn => row1.addComponents(btn));
      buildButtons.slice(5, 8).forEach(btn => row2.addComponents(btn));

      const components = [];
      if (row1.components.length > 0) components.push(row1);
      if (row2.components.length > 0) components.push(row2);

      const embed = new EmbedBuilder()
        .setTitle('📊 Structured Report - Select Build')
        .setDescription('Choose the build version for your structured report submission:')
        .setColor(0x5865f2)
        .setFooter({ text: 'Select a build version to open the submission form' });

      await interaction.editReply({
        embeds: [embed],
        components: components,
      });
    } catch (error) {
      console.error('Error in handleStructuredReportBuildSelection:', error);
      try {
        await interaction.editReply({
          content: '❌ An error occurred while loading build selection. Please try again later.',
        });
      } catch (replyError) {
        console.error('Failed to send error message:', replyError);
      }
    }
  }

  private getStructuredReportBuildForms(): Array<{ version: string; formUrl: string }> {
    // Get build forms from config (already parsed in config.ts)
    const buildForms = this.configService.get<Array<{ version: string; formUrl: string }>>('forms.structuredReportBuilds') || [];
    
    // Filter out placeholder URLs
    return buildForms.filter(build => 
      build.version && 
      build.formUrl && 
      build.formUrl.startsWith('http') && 
      !build.formUrl.includes('PLACEHOLDER')
    );
  }

  private getCurrentAllInOneAllBuildLink(): { version: string; formUrl: string } | null {
    const allInOneBuilds =
      this.configService.get<Array<{ version: string; formUrl: string }>>('forms.allInOneBuilds') || [];

    if (!allInOneBuilds.length) return null;

    const now = new Date();

    const schedule: Array<{ version: string; from: Date }> = [
      // Before 6 March 2026 11:00 UTC we show 2.11
      { version: '2.12', from: new Date(Date.UTC(2026, 2, 6, 11, 0, 0)) },
      { version: '2.13', from: new Date(Date.UTC(2026, 2, 13, 11, 0, 0)) },
      { version: '2.14', from: new Date(Date.UTC(2026, 2, 20, 11, 0, 0)) },
      { version: '2.15', from: new Date(Date.UTC(2026, 2, 27, 11, 0, 0)) },
      { version: '2.16', from: new Date(Date.UTC(2026, 3, 3, 11, 0, 0)) },
      { version: '2.17', from: new Date(Date.UTC(2026, 3, 10, 11, 0, 0)) },
    ];

    let currentVersion = '2.11';
    for (const step of schedule) {
      if (now >= step.from) {
        currentVersion = step.version;
      } else {
        break;
      }
    }

    const match = allInOneBuilds.find((b) => b.version === currentVersion);
    if (!match) {
      return null;
    }

    return match;
  }

  private async getStructuredReportLink(): Promise<string | undefined> {
    try {
      // Use process.env directly first, then fallback to config
      let structuredReportLinks: string[] = [];
      
      if (process.env.FORM_STRUCTURED_REPORT_LINKS) {
        structuredReportLinks = process.env.FORM_STRUCTURED_REPORT_LINKS.split(',').map((link) => link.trim()).filter(link => link.length > 0);
      } else {
        const configLinks = this.configService.get('forms.structuredReportLinks') || [];
        structuredReportLinks = Array.isArray(configLinks) ? configLinks : [];
      }
      
      console.log('Structured report links:', structuredReportLinks);
      
      if (structuredReportLinks.length === 0) {
        return process.env.FORM_STRUCTURED_REPORT || this.configService.get('forms.structuredReport');
      }

      // Calculate which 8-week period we're in based on week number in year
      const now = new Date();
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const daysSinceStart = Math.floor((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
      const weekNumber = Math.floor(daysSinceStart / 7);
      const periodIndex = Math.floor(weekNumber / 8) % structuredReportLinks.length;

      return structuredReportLinks[periodIndex] || structuredReportLinks[0];
    } catch (error) {
      console.error('Error in getStructuredReportLink:', error);
      return process.env.FORM_STRUCTURED_REPORT;
    }
  }
}
