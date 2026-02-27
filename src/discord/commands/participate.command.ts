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

      // If process.env has no FORM_* (e.g. under nest start --watch), load from .env file
      const formEnvKeys = Object.keys(process.env).filter((k) => k.startsWith('FORM_'));
      if (formEnvKeys.length === 0) {
        const fromFile = this.loadFormUrlsFromEnvFile();
        if (fromFile) Object.assign(process.env, fromFile);
      }

      let screenshotUrl = this.configService.get<string>('forms.screenshot') || process.env.FORM_SCREENSHOT;
      let bugReproUrl = this.configService.get<string>('forms.bugRepro') || process.env.FORM_BUG_REPRO;
      let bugVideoUrl = this.configService.get<string>('forms.bugVideo') || process.env.FORM_BUG_VIDEO;
      let balanceUrl = this.configService.get<string>('forms.balanceAnalysis') || process.env.FORM_BALANCE_ANALYSIS;
      let retestUrl = this.configService.get<string>('forms.retest') || process.env.FORM_RETEST;
      
      // Get current structured report link (changes every 8 weeks)
      let structuredReportLink: string | undefined;
      try {
        structuredReportLink = await this.getStructuredReportLink();
        console.log('Structured report link:', structuredReportLink);
      } catch (linkError) {
        console.error('Error getting structured report link:', linkError);
        structuredReportLink = process.env.FORM_STRUCTURED_REPORT;
      }

      // Helper function to create button only if URL is valid
      const createButtonIfValid = (label: string, url: string | undefined): ButtonBuilder | null => {
        console.log(`\n[Button Check] "${label}":`, {
          url: url,
          type: typeof url,
          isUndefined: url === undefined,
          isNull: url === null,
          isEmpty: url === '',
          trimmed: url ? url.trim() : 'N/A',
        });
        
        if (!url) {
          console.log(`❌ Skipping button "${label}" - URL is undefined/null`);
          return null;
        }
        
        if (typeof url !== 'string') {
          console.log(`❌ Skipping button "${label}" - URL is not a string (type: ${typeof url})`);
          return null;
        }
        
        const trimmedUrl = url.trim();
        
        if (trimmedUrl === '' || trimmedUrl === '#') {
          console.log(`❌ Skipping button "${label}" - URL is empty or placeholder`);
          return null;
        }
        
        if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
          console.log(`❌ Skipping button "${label}" - URL doesn't start with http/https:`, trimmedUrl);
          return null;
        }
        
        console.log(`✅ Creating button "${label}" with URL:`, trimmedUrl);
        return new ButtonBuilder()
          .setLabel(label)
          .setStyle(ButtonStyle.Link)
          .setURL(trimmedUrl);
      };

      // Create buttons (only if URLs are valid) - in the requested order
      const buttons: ButtonBuilder[] = [];
      
      // 1. Balance Analysis (30 gems)
      const balanceBtn = createButtonIfValid('Balance Analysis (30 gems)', balanceUrl);
      if (balanceBtn) buttons.push(balanceBtn);
      
      // 2. Bug with Screenshot (5 gems)
      const screenshotBtn = createButtonIfValid('Bug with Screenshot (5 gems)', screenshotUrl);
      if (screenshotBtn) buttons.push(screenshotBtn);
      
      // 3. Bug with Reproduction Steps (25 gems)
      const bugReproBtn = createButtonIfValid('Bug with Reproduction Steps (25 gems)', bugReproUrl);
      if (bugReproBtn) buttons.push(bugReproBtn);
      
      // 4. Bug with Video (40 gems)
      const bugVideoBtn = createButtonIfValid('Bug with Video (40 gems)', bugVideoUrl);
      if (bugVideoBtn) buttons.push(bugVideoBtn);
      
      // 5. Re-test Confirmation (15 gems)
      const retestBtn = createButtonIfValid('Re-test Confirmation (15 gems)', retestUrl);
      if (retestBtn) buttons.push(retestBtn);
      
      // 6. Structured Report button - interactive (not link) to show build selection
      const structuredBtn = new ButtonBuilder()
        .setLabel('Structured Report')
        .setStyle(ButtonStyle.Primary)
        .setCustomId('structured_report_select_build');
      buttons.push(structuredBtn);
      
      // 7. Record your session button
      const recordSessionUrl = this.configService.get<string>('forms.recordSession') || process.env.FORM_RECORD_SESSION;
      const recordSessionBtn = createButtonIfValid('Record your session', recordSessionUrl);
      if (recordSessionBtn) buttons.push(recordSessionBtn);

      console.log(`\n=== Button Creation Summary ===`);
      console.log(`Total buttons created: ${buttons.length}`);
      console.log(`Button details:`, buttons.map(btn => {
        const json = btn.toJSON() as any;
        return { label: json.label, url: json.url };
      }));

      // Split buttons into rows (max 5 buttons per row in Discord, max 5 rows total)
      const row1 = new ActionRowBuilder<ButtonBuilder>();
      const row2 = new ActionRowBuilder<ButtonBuilder>();
      
      // First row: up to 5 buttons
      buttons.slice(0, 5).forEach(btn => row1.addComponents(btn));
      // Second row: remaining buttons (up to 5)
      buttons.slice(5, 10).forEach(btn => row2.addComponents(btn));

      const components = [];
      if (row1.components.length > 0) {
        components.push(row1);
        console.log(`Row 1: ${row1.components.length} buttons`);
      }
      if (row2.components.length > 0) {
        components.push(row2);
        console.log(`Row 2: ${row2.components.length} buttons`);
      }

      console.log(`\n=== Final Component Summary ===`);
      console.log(`Total component rows: ${components.length}`);
      console.log(`Total buttons: ${buttons.length}`);
      console.log(`Will send components: ${components.length > 0 ? 'YES' : 'NO'}`);

      const gem = this.discordService.getGemEmoji();

      const embed = new EmbedBuilder()
        .setTitle('🎯 Participate in Tester Army')
        .setDescription(`Click the buttons below to submit your contributions. Each submission type awards different ${gem} gems.`)
        .setColor(0x5865f2)
        .addFields(
          {
            name: '📸 Bug with screenshot',
            value: `5 ${gem}`,
            inline: true,
          },
          {
            name: '🐛 Bug with Reproduction Steps',
            value: `25 ${gem}`,
            inline: true,
          },
          {
            name: '🎥 Bug with Video',
            value: `40 ${gem}`,
            inline: true,
          },
          {
            name: '⚖️ Balance Analysis',
            value: `30 ${gem}`,
            inline: true,
          },
          {
            name: '✅ Re-test Confirmation',
            value: `15 ${gem}`,
            inline: true,
          },
          {
            name: '🎬 Record your session',
            value: 'Varies by review',
            inline: true,
          },
          {
            name: '📊 Structured Report',
            value: 'Varies by cycle',
            inline: true,
          },
        )
        .setFooter({ text: 'Links are updated automatically. Structured Report link changes every 8 weeks.' });

      const replyOptions: any = {
        embeds: [embed],
      };

      if (components.length > 0) {
        replyOptions.components = components;
        console.log('✅ Adding components to reply');
        console.log('Components structure:', JSON.stringify(components.map(row => ({
          components: row.components.map(btn => {
            const json = btn.toJSON() as any;
            return { label: json.label, url: json.url };
          }),
        })), null, 2));
      } else {
        console.warn('⚠️ WARNING: No components to add!');
        console.warn(`Buttons array length: ${buttons.length}`);
        console.warn('This means all URLs were invalid or missing. Check the logs above for details.');
        // Add a message if no buttons are available
        const currentDescription = embed.data.description || 'Click the buttons below to submit your contributions. Each submission type awards different gems.';
        embed.setDescription(
          currentDescription + '\n\n⚠️ **Note:** Form links are not configured. Please contact an administrator.'
        );
      }

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
        .setTitle('📊 Record your First Session and Feedback - Select Build')
        .setDescription('Choose the build version for your session & feedback submission:')
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
