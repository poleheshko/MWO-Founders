import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { TesterArmyService } from '../tester-army/tester-army.service';
import { ConfigService } from '@nestjs/config';
import { TesterRank } from '../database/entities/army-tester.entity';
import { SubmissionService } from '../submission/submission.service';

@Injectable()
export class RankService {
  private readonly rankConfig: {
    explorer: { tc: number };
    testPilot: { tc: number };
    foundersCircle: { tc: number; topN: number };
  };

  constructor(
    private readonly testerArmyService: TesterArmyService,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => SubmissionService))
    private readonly submissionService: SubmissionService,
  ) {
    this.rankConfig = this.configService.get('ranks');
  }

  async evaluateRank(discordUserId: string): Promise<TesterRank> {
    const tester = await this.testerArmyService.getTester(discordUserId);
    if (!tester) {
      return 'recruit';
    }

    const newRank = await this.determineRank(
      tester.tcConfirmedTotal,
    );

    if (newRank !== tester.currentRank) {
      await this.testerArmyService.updateRank(discordUserId, newRank);
      return newRank;
    }

    return tester.currentRank;
  }

  private async determineRank(
    tcConfirmed: number,
  ): Promise<TesterRank> {
    // Check Founders Circle: TC >= 900 OR Top 15 in all-time leaderboard
    if (tcConfirmed >= this.rankConfig.foundersCircle.tc) {
      return 'founders_circle';
    }

    // Check if in top N (need to query leaderboard)
    const leaderboard = await this.submissionService.getLeaderboard(
      'all',
      undefined,
      this.rankConfig.foundersCircle.topN,
    );
    // Note: This is a simplified check - in production, you'd check if user is in top N
    // For now, we'll rely on TC threshold

    // Check Test Pilot: TC >= 250 (structured reports requirement removed)
    if (tcConfirmed >= this.rankConfig.testPilot.tc) {
      return 'test_pilot';
    }

    // Check Explorer: TC >= 60
    if (tcConfirmed >= this.rankConfig.explorer.tc) {
      return 'explorer';
    }

    return 'recruit';
  }

  async syncDiscordRoles(
    discordUserId: string,
    guild: any,
  ): Promise<void> {
    // Role management disabled - roles are managed manually by admins
    // This function is kept for API compatibility but does nothing
    return;
  }
}
