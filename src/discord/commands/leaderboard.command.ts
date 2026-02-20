import { Injectable } from '@nestjs/common';
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import { SubmissionService } from '../../submission/submission.service';
import { CycleService } from '../../cycle/cycle.service';
import { PlayerService } from '../../player/player.service';

@Injectable()
export class LeaderboardCommand {
  constructor(
    private readonly submissionService: SubmissionService,
    private readonly cycleService: CycleService,
    private readonly playerService: PlayerService,
  ) {}

  data = new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View the Tester Army leaderboard')
    .addStringOption((option) =>
      option
        .setName('scope')
        .setDescription('Leaderboard scope')
        .setRequired(false)
        .addChoices(
          { name: 'This Week', value: 'week' },
          { name: 'All Time', value: 'all' },
        ),
    );

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

    const scope = (interaction.options.getString('scope') || 'all') as
      | 'week'
      | 'all';

    let cycleId: string | undefined;
    if (scope === 'week') {
      const activeCycle = await this.cycleService.getActiveCycle();
      if (!activeCycle) {
        await interaction.editReply({
          content: '⚠️ No active weekly cycle found.',
        });
        return;
      }
      cycleId = activeCycle.id;
    }

    const leaderboard = await this.submissionService.getLeaderboard(
      scope,
      cycleId,
      10,
    );

    if (leaderboard.length === 0) {
      await interaction.editReply({
        content: '📊 No submissions found for this leaderboard.',
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(
        `🏆 Tester Army Leaderboard - ${scope === 'week' ? 'This Week' : 'All Time'}`,
      )
      .setColor(0xffd700)
      .setDescription(
        leaderboard
          .map(
            (entry, index) =>
              `${this.getMedal(index)} **${entry.username}** - ${entry.totalTc} <:gem:1>`,
          )
          .join('\n'),
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }

  private getMedal(index: number): string {
    const medals = ['🥇', '🥈', '🥉'];
    return medals[index] || `${index + 1}.`;
  }
}
