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
        'Here are the rewards available at the end of the Founders Circle program. Keep testing and earning <:gem:1> to unlock them!',
      )
      .setColor(0x5865f2)
      .addFields(
        {
          name: '💎 <:gem:1> Reward Store',
          value:
            '```\n' +
            ' 100 <:gem:1> → Small Exclusive Pack\n' +
            ' 250 <:gem:1> → Medium Exclusive Pack\n' +
            ' 500 <:gem:1> → Large Exclusive Pack\n' +
            ' 800 <:gem:1> → Elite Exclusive Pack\n' +
            '1200 <:gem:1> → Founder-Only Collectible\n' +
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
        text: 'Use /founders profile to check your current <:gem:1> • Use /leaderboard to see rankings',
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}
