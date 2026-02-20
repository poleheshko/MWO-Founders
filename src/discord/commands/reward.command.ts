import { Injectable } from '@nestjs/common';
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import { PlayerService } from '../../player/player.service';
import { DiscordService } from '../discord.service';

@Injectable()
export class RewardCommand {
  constructor(
    private readonly playerService: PlayerService,
    private readonly discordService: DiscordService,
  ) {}

  data = new SlashCommandBuilder()
    .setName('reward')
    .setDescription('View available rewards at the end of the program');

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: false });

    const player = await this.playerService.getPlayer(interaction.user.id);
    if (!player?.email || !player.email.includes('@')) {
      await interaction.editReply({
        content:
          '⚠️ **Email required**\n\nUse `/founders add-email` to set your email first (same as in the submission forms).',
      });
      return;
    }

    const gem = this.discordService.getGemEmoji();

    const embed = new EmbedBuilder()
      .setTitle('🎁 Program Rewards')
      .setDescription(
        `Here are the rewards available in the Founders Circle program. Keep testing and earning ${gem} gems!`,
      )
      .setColor(0x5865f2)
      .addFields(
        {
          name: `💰 Testing Benefits`,
          value:
            '**Participation:**\n' +
            `100 ${gem} every week (800 in total)\n\n` +
            '**First experience video (min. 5 min):**\n' +
            `400 ${gem} every week (3200 in total)\n\n` +
            '**Deep analysis packages** (screens + written feedback):\n' +
            `25-40 ${gem} for proven bug (up to 1000 ${gem} per week)\n\n` +
            '> Quality > quantity.',
          inline: false,
        },
        {
          name: '🏆 Weekly Game Winners',
          value:
            `🥇 1st place  →  2000 ${gem}\n` +
            `🥈 2nd place  →  1000 ${gem}\n` +
            `🥉 3rd place  →   750 ${gem}\n` +
            `4-10th     →   500 ${gem}\n` +
            `11-20th    →   100 ${gem}`,
          inline: false,
        },
      )
      .setFooter({
        text: 'Use /founders profile to check your current gems • Use /leaderboard to see rankings',
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}
