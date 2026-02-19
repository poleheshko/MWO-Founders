import { Injectable } from '@nestjs/common';
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import { PlayerService } from '../../player/player.service';

@Injectable()
export class RewardCommand {
  constructor(private readonly playerService: PlayerService) {}

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

    const embed = new EmbedBuilder()
      .setTitle('🎁 Program Rewards')
      .setDescription(
        'Here are the rewards available at the end of the Founders Circle program. Keep testing and earning TC to unlock them!',
      )
      .setColor(0x5865f2)
      .addFields(
        {
          name: '💎 TC Reward Store',
          value:
            '```\n' +
            ' 100 TC → Small Exclusive Pack\n' +
            ' 250 TC → Medium Exclusive Pack\n' +
            ' 500 TC → Large Exclusive Pack\n' +
            ' 800 TC → Elite Exclusive Pack\n' +
            '1200 TC → Founder-Only Collectible\n' +
            '```',
          inline: false,
        },
        {
          name: '🏆 Rank-Based Rewards',
          value:
            '**Top 10** → Founders Launch Pack\n' +
            '**Top 50** → Test Pilot Launch Pack\n' +
            '**All Finishers** → Season Finisher Collectible',
          inline: false,
        },
      )
      .setFooter({
        text: 'Use /founders profile to check your current TC • Use /leaderboard to see rankings',
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}
