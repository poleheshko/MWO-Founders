import { Injectable, Inject, forwardRef, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Submission,
  SubmissionType,
  SubmissionStatus,
  QaStatus,
} from '../database/entities/submission.entity';
import { ConfigService } from '@nestjs/config';
import { TesterArmyService } from '../tester-army/tester-army.service';
import { RankService } from '../rank/rank.service';
import { CycleService } from '../cycle/cycle.service';

@Injectable()
export class SubmissionService {
  private readonly logger = new Logger(SubmissionService.name);
  private readonly gemsConfig: Record<string, number>;

  constructor(
    @InjectRepository(Submission)
    private readonly submissionRepository: Repository<Submission>,
    private readonly configService: ConfigService,
    private readonly testerArmyService: TesterArmyService,
    private readonly cycleService: CycleService,
    @Inject(forwardRef(() => RankService))
    private readonly rankService: RankService,
  ) {
    const gems = this.configService.get('gems');
    this.gemsConfig = {
      quick_test: gems.quickTest,
      survey: gems.survey,
      screenshot: gems.screenshot,
      bug_repro: gems.bugRepro,
      bug_video: gems.bugVideo,
      balance_analysis: gems.balanceAnalysis,
      retest: gems.retest,
      shipped_bonus: gems.shippedBonus,
      structured_report_bonus: 0, // Set at award time
      video_session: 0,
      playtime_minimum: 0,
    };
  }

  private static readonly CAPPED_TYPES: SubmissionType[] = [
    'quick_test',
    'survey',
    'screenshot',
    'bug_repro',
    'bug_video',
    'balance_analysis',
    'retest',
  ];

  private isCappedType(type: SubmissionType): boolean {
    return (SubmissionService.CAPPED_TYPES as string[]).includes(type);
  }

  private async getCappedTcForUserInBuild(
    discordUserId: string,
    cycleId: string | null,
    excludeSubmissionId?: string,
  ): Promise<number> {
    if (!cycleId) return 0;
    const qb = this.submissionRepository
      .createQueryBuilder('s')
      .where('s.discord_user_id = :userId', { userId: discordUserId })
      .andWhere('s.cycle_id = :cycleId', { cycleId })
      .andWhere('s.status = :status', { status: 'approved' })
      .andWhere('s.type IN (:...types)', {
        types: SubmissionService.CAPPED_TYPES,
      });
    if (excludeSubmissionId) {
      qb.andWhere('s.id != :excludeId', { excludeId: excludeSubmissionId });
    }
    const result = await qb.select('COALESCE(SUM(s.tc_awarded), 0)', 'total').getRawOne();
    return parseInt(result?.total ?? '0', 10);
  }

  private async applyBuildCap(
    discordUserId: string,
    cycleId: string | null,
    type: SubmissionType,
    tcAwarded: number,
    excludeSubmissionId?: string,
  ): Promise<number> {
    if (!this.isCappedType(type) || tcAwarded <= 0) return tcAwarded;
    const maxPerBuild = this.configService.get<number>('build.maxGemsPerBuild') ?? 1000;
    const existing = await this.getCappedTcForUserInBuild(
      discordUserId,
      cycleId,
      excludeSubmissionId,
    );
    const remaining = Math.max(0, maxPerBuild - existing);
    return Math.min(tcAwarded, remaining);
  }

  getTcProposed(type: SubmissionType, payload: Record<string, any>): number {
    // Special handling for bug submissions
    if (type === 'bug_repro' || type === 'bug_video') {
      if (payload.hasVideo || payload.evidenceUrls?.some((url: string) => url.includes('video'))) {
        return this.gemsConfig.bug_video;
      }
      return this.gemsConfig.bug_repro;
    }

    return this.gemsConfig[type] || 0;
  }

  async createSubmission(
    discordUserId: string,
    type: SubmissionType,
    payload: Record<string, any>,
    evidenceUrls: string[] = [],
    cycleId?: string,
    status: SubmissionStatus = 'pending',
  ): Promise<Submission> {
    const tcProposed = this.getTcProposed(type, payload);
    const tcAwarded = status === 'approved' ? tcProposed : 0;

    const submission = this.submissionRepository.create({
      discordUserId,
      type,
      payloadJson: payload,
      evidenceUrls,
      cycleId: cycleId || null,
      status,
      tcProposed,
      tcAwarded,
      qaStatus: null,
      qaBuildVersion: null,
    });

    const saved = await this.submissionRepository.save(submission);
    await this.recalculateTotals(discordUserId);
    return saved;
  }

  async createStructuredReportSubmission(
    discordUserId: string,
    type: 'bug_repro' | 'bug_video' | 'balance_analysis',
    payload: Record<string, any>,
    evidenceUrls: string[] = [],
    cycleId?: string,
    status: SubmissionStatus = 'pending',
    tcProposed: number = 0,
    qaStatus: QaStatus = null,
    qaBuildVersion: string | null = null,
  ): Promise<Submission> {
    // Determine tcAwarded based on QA status
    let tcAwarded = 0;
    
    if (status === 'approved') {
      if (qaStatus === 'no_need_auto_points') {
        // Auto-approve: award points
        tcAwarded = tcProposed;
      } else if (qaStatus === 'qa_please_check' && qaBuildVersion) {
        // QA has entered build version: award points
        tcAwarded = tcProposed;
        status = 'approved';
      } else if (qaStatus === 'qa_please_check' && !qaBuildVersion) {
        // Waiting for QA: don't award points yet
        tcAwarded = 0;
        status = 'pending';
      } else if (qaStatus === 'no_need_duplicate') {
        // Duplicate: don't award points
        tcAwarded = 0;
        status = 'declined';
      } else {
        // Default: use proposed points if approved
        tcAwarded = tcProposed;
      }
    }

    // Apply 1000 Gems per build cap for normal submissions
    if (status === 'approved' && tcAwarded > 0) {
      tcAwarded = await this.applyBuildCap(discordUserId, cycleId || null, type, tcAwarded);
    }

    const submission = this.submissionRepository.create({
      discordUserId,
      type,
      payloadJson: payload,
      evidenceUrls,
      cycleId: cycleId || null,
      status,
      tcProposed,
      tcAwarded,
      qaStatus,
      qaBuildVersion,
    });

    const saved = await this.submissionRepository.save(submission);
    await this.recalculateTotals(discordUserId);
    return saved;
  }

  async updateQaStatus(
    submissionId: string,
    qaStatus: QaStatus,
    qaBuildVersion: string | null = null,
    tcProposed?: number,
  ): Promise<Submission> {
    const submission = await this.submissionRepository.findOne({
      where: { id: submissionId },
    });

    if (!submission) {
      throw new Error(`Submission ${submissionId} not found`);
    }

    submission.qaStatus = qaStatus;
    submission.qaBuildVersion = qaBuildVersion;

    // Update proposed points if provided
    if (tcProposed !== undefined) {
      submission.tcProposed = tcProposed;
    }

    // Update status and points based on QA status
    if (qaStatus === 'no_need_auto_points') {
      submission.status = 'approved';
      let awarded = submission.tcProposed;
      awarded = await this.applyBuildCap(
        submission.discordUserId,
        submission.cycleId,
        submission.type,
        awarded,
        submission.id,
      );
      submission.tcAwarded = awarded;
    } else if (qaStatus === 'qa_please_check') {
      if (qaBuildVersion) {
        // QA has entered build version: approve and award points
        submission.status = 'approved';
        let awarded = submission.tcProposed;
        awarded = await this.applyBuildCap(
          submission.discordUserId,
          submission.cycleId,
          submission.type,
          awarded,
          submission.id,
        );
        submission.tcAwarded = awarded;
      } else {
        // Still waiting for build version
        submission.status = 'pending';
        submission.tcAwarded = 0;
      }
    } else if (qaStatus === 'no_need_duplicate') {
      submission.status = 'declined';
      submission.tcAwarded = 0;
    } else if (qaStatus === null) {
      // If QA status is removed/null, reset to pending (unless manually reviewed)
      // Only reset if it was previously declined due to QA status, not manual review
      if (submission.status === 'declined' && !submission.reviewedBy) {
        submission.status = 'pending';
        submission.tcAwarded = 0;
      }
    }

    const saved = await this.submissionRepository.save(submission);
    await this.recalculateTotals(submission.discordUserId);
    return saved;
  }

  /**
   * Update submission status and awarded points (for structured report builds)
   */
  async updateSubmissionStatusAndPoints(
    submissionId: string,
    status: 'pending' | 'approved' | 'declined',
    tcAwarded: number,
  ): Promise<Submission> {
    const submission = await this.submissionRepository.findOne({
      where: { id: submissionId },
    });

    if (!submission) {
      throw new Error(`Submission ${submissionId} not found`);
    }

    submission.status = status;

    let awarded = tcAwarded;
    if (status === 'approved') {
      awarded = await this.applyBuildCap(
        submission.discordUserId,
        submission.cycleId,
        submission.type,
        awarded,
        submission.id,
      );
    }
    submission.tcAwarded = awarded;

    const saved = await this.submissionRepository.save(submission);
    await this.recalculateTotals(submission.discordUserId);
    return saved;
  }

  /**
   * Merge fields into submission payload (e.g. All-in-One breakdown: ifGems, sGems, vGems, srGems).
   */
  async updateSubmissionPayload(
    submissionId: string,
    payloadUpdate: Record<string, unknown>,
  ): Promise<Submission> {
    const submission = await this.submissionRepository.findOne({
      where: { id: submissionId },
    });
    if (!submission) {
      throw new Error(`Submission ${submissionId} not found`);
    }
    submission.payloadJson = { ...submission.payloadJson, ...payloadUpdate };
    return this.submissionRepository.save(submission);
  }

  /**
   * Update discordUserId for a submission
   * Used when consolidating submissions from temp Discord ID to real Discord ID
   */
  async updateSubmissionDiscordUserId(
    submissionId: string,
    newDiscordUserId: string,
  ): Promise<Submission> {
    const submission = await this.submissionRepository.findOne({
      where: { id: submissionId },
    });

    if (!submission) {
      throw new Error(`Submission ${submissionId} not found`);
    }

    const oldDiscordUserId = submission.discordUserId;
    submission.discordUserId = newDiscordUserId;

    const saved = await this.submissionRepository.save(submission);
    
    // Recalculate totals for both old and new Discord IDs
    await this.recalculateTotals(oldDiscordUserId);
    await this.recalculateTotals(newDiscordUserId);
    
    return saved;
  }

  /**
   * Find submission by email and timestamp
   * Used to detect duplicates when Player ID changes
   */
  async findSubmissionByEmailAndTimestamp(
    email: string,
    googleTimestamp: string,
    type: SubmissionType,
  ): Promise<Submission | null> {
    const submissions = await this.submissionRepository.find({
      where: {
        type,
      },
    });

    const matchingSubmission = submissions.find(
      (s) =>
        s.payloadJson?.googleTimestamp === googleTimestamp &&
        s.payloadJson?.email === email,
    );

    return matchingSubmission || null;
  }

  async reviewSubmission(
    submissionId: string,
    reviewerId: string,
    approve: boolean,
    publicComment?: string,
    privateComment?: string,
  ): Promise<Submission> {
    const submission = await this.submissionRepository.findOne({
      where: { id: submissionId },
    });

    if (!submission) {
      throw new Error(`Submission ${submissionId} not found`);
    }

    submission.status = approve ? 'approved' : 'declined';
    submission.tcAwarded = approve ? submission.tcProposed : 0;
    submission.reviewedBy = reviewerId;
    submission.reviewedAt = new Date();
    submission.reviewCommentPublic = publicComment || null;
    submission.reviewCommentPrivate = privateComment || null;

    const saved = await this.submissionRepository.save(submission);
    await this.recalculateTotals(submission.discordUserId);
    return saved;
  }

  async recalculateTotals(discordUserId: string): Promise<void> {
    const submissions = await this.submissionRepository.find({
      where: { discordUserId },
    });

    // Calculate pending Gems - only count submissions that are truly pending
    // For QA Please Check status, only count as pending if build version is not set
    const tcPending = submissions
      .filter((s) => {
        if (s.status === 'pending') {
          // If it's QA Please Check without build version, count as pending
          if (s.qaStatus === 'qa_please_check' && !s.qaBuildVersion) {
            return true;
          }
          // Regular pending submissions
          return true;
        }
        return false;
      })
      .reduce((sum, s) => sum + s.tcProposed, 0);

    // Calculate confirmed Gems - only approved submissions with awarded points
    // For QA Please Check, only count if build version is set
    const tcConfirmed = submissions
      .filter((s) => {
        if (s.status === 'approved') {
          // If it's QA Please Check, only count if build version is set
          if (s.qaStatus === 'qa_please_check') {
            return !!s.qaBuildVersion;
          }
          // Don't count duplicates
          if (s.qaStatus === 'no_need_duplicate') {
            return false;
          }
          return true;
        }
        return false;
      })
      .reduce((sum, s) => sum + s.tcAwarded, 0);

    const structuredTypes: SubmissionType[] = [
      'bug_repro',
      'bug_video',
      'balance_analysis',
    ];
    const structuredReportsConfirmed = submissions.filter(
      (s) => {
        if (s.status === 'approved' && structuredTypes.includes(s.type)) {
          // For QA Please Check, only count if build version is set
          if (s.qaStatus === 'qa_please_check') {
            return !!s.qaBuildVersion;
          }
          // Don't count duplicates
          if (s.qaStatus === 'no_need_duplicate') {
            return false;
          }
          return true;
        }
        return false;
      },
    ).length;

    // Only update totals if tester exists (skip for temp Discord IDs)
    const tester = await this.testerArmyService.getTester(discordUserId);
    if (tester) {
      await this.testerArmyService.updateTcTotals(
        discordUserId,
        tcConfirmed,
        tcPending,
        structuredReportsConfirmed,
      );

      // Re-evaluate rank
      await this.rankService.evaluateRank(discordUserId);
    } else {
      // For temp Discord IDs or users not in tester army, skip updating totals
      // Totals will be updated when the user joins Discord and gets a real Discord ID
      this.logger.debug(
        `Skipping totals update for ${discordUserId} - tester not found (may be temp Discord ID)`,
      );
    }
  }

  async getSubmissionsByUser(
    discordUserId: string,
    limit: number = 5,
    status?: SubmissionStatus,
  ): Promise<Submission[]> {
    const where: any = { discordUserId };
    if (status) {
      where.status = status;
    }
    return await this.submissionRepository.find({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async getSubmissionsByCycle(
    cycleId: string,
    status?: SubmissionStatus,
  ): Promise<Submission[]> {
    const where: any = { cycleId };
    if (status) {
      where.status = status;
    }
    return await this.submissionRepository.find({
      where,
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }

  async getLeaderboard(
    scope: 'week' | 'all',
    cycleId?: string,
    limit: number = 10,
  ): Promise<Array<{ discordUserId: string; totalTc: number; username: string }>> {
    const query = this.submissionRepository
      .createQueryBuilder('submission')
      .select('submission.discordUserId', 'discordUserId')
      .addSelect('SUM(submission.tc_proposed)', 'totalTc')
      .groupBy('submission.discordUserId')
      .orderBy('SUM(submission.tc_proposed)', 'DESC')
      .limit(limit);

    // Nie licz punktów z odrzuconych zgłoszeń (declined) na leaderboardzie
    query.andWhere('submission.status != :declinedStatus', {
      declinedStatus: 'declined',
    });

    if (scope === 'week' && cycleId) {
      query.andWhere('submission.cycleId = :cycleId', { cycleId });
    }

    const results = await query.getRawMany();

    // Fetch usernames
    const userIds = results.map((r) => r.discordUserId);
    const submissions = await this.submissionRepository.find({
      where: userIds.map((id) => ({ discordUserId: id })),
      relations: ['user'],
    });

    const userMap = new Map(
      submissions.map((s) => [s.discordUserId, s.user.discordUsername || 'Unknown']),
    );

    return results.map((r) => ({
      discordUserId: r.discordUserId,
      totalTc: parseInt(r.totalTc, 10),
      username: userMap.get(r.discordUserId) || 'Unknown',
    }));
  }

  /**
   * Returns a short leaderboard snippet centered on the user (for highlight messages).
   * Format: "#20 username — 95 💎". The highlighted user's name is bolded.
   * No ellipses before/after the list.
   */
  async getLeaderboardSnippetForUser(
    discordUserId: string,
    gemEmoji: string,
    cycleId?: string,
  ): Promise<string> {
    const activeCycle = cycleId ? null : await this.cycleService.getActiveCycle();
    const buildId = cycleId ?? activeCycle?.id ?? null;
    if (!buildId) return '';

    const full = await this.getLeaderboard('week', buildId, 100);
    const idx = full.findIndex((e) => e.discordUserId === discordUserId);
    if (idx < 0) return '';

    const start = Math.max(0, idx - 1);
    const end = Math.min(full.length, idx + 2);
    const slice = full.slice(start, end);

    const lines = slice.map((e, i) => {
      const rank = start + i + 1;
      const name = e.discordUserId === discordUserId ? `**${e.username}**` : e.username;
      return `#${rank} ${name} — ${e.totalTc} ${gemEmoji}`;
    });

    return lines.join('\n');
  }

  /**
   * Returns the user's total gems for the active (or given) build, or null if not on leaderboard.
   */
  async getTotalGemsForUserInBuild(
    discordUserId: string,
    cycleId?: string,
  ): Promise<number | null> {
    const activeCycle = cycleId ? null : await this.cycleService.getActiveCycle();
    const buildId = cycleId ?? activeCycle?.id ?? null;
    if (!buildId) return null;
    const full = await this.getLeaderboard('week', buildId, 500);
    const entry = full.find((e) => e.discordUserId === discordUserId);
    return entry ? entry.totalTc : null;
  }

  async checkRateLimit(
    discordUserId: string,
    maxPerHour: number,
  ): Promise<{ allowed: boolean; remaining: number }> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentSubmissions = await this.submissionRepository
      .createQueryBuilder('submission')
      .where('submission.discordUserId = :discordUserId', { discordUserId })
      .andWhere('submission.createdAt >= :oneHourAgo', { oneHourAgo })
      .getCount();

    return {
      allowed: recentSubmissions < maxPerHour,
      remaining: Math.max(0, maxPerHour - recentSubmissions),
    };
  }

  /**
   * Award delivered features points to multiple users at once.
   * These are exempt from the 1000 Gems per build cap.
   */
  async awardDeliveredFeatures(
    discordUserIds: string[],
    type: 'structured_report_bonus' | 'video_session' | 'playtime_minimum',
    tcPerUser: number,
    payload: Record<string, any> & { reason?: string },
    cycleId?: string,
    awardedBy?: string,
  ): Promise<Submission[]> {
    const activeCycle = await this.cycleService.getActiveCycle();
    const buildId = cycleId ?? activeCycle?.id ?? null;

    const submissions: Submission[] = [];
    for (const discordUserId of discordUserIds) {
      const sub = this.submissionRepository.create({
        discordUserId,
        type,
        payloadJson: payload,
        evidenceUrls: [],
        cycleId: buildId,
        status: 'approved',
        tcProposed: tcPerUser,
        tcAwarded: tcPerUser,
        reviewedBy: awardedBy ?? null,
        reviewedAt: new Date(),
      });
      const saved = await this.submissionRepository.save(sub);
      await this.recalculateTotals(discordUserId);
      submissions.push(saved);
    }
    return submissions;
  }

  async createManualAdjustment(
    discordUserId: string,
    delta: number,
    reason: string,
    adjustedBy: string,
  ): Promise<Submission> {
    const submission = this.submissionRepository.create({
      discordUserId,
      type: 'manual_adjust',
      payloadJson: { reason, adjustedBy },
      evidenceUrls: [],
      status: 'approved',
      tcProposed: delta,
      tcAwarded: delta,
      reviewedBy: adjustedBy,
      reviewedAt: new Date(),
    });

    const saved = await this.submissionRepository.save(submission);
    await this.recalculateTotals(discordUserId);
    return saved;
  }

  async findSubmissionByGoogleTimestamp(
    discordUserId: string,
    googleTimestamp: string,
    type: SubmissionType,
    email?: string,
  ): Promise<Submission | null> {
    // First try to find by discordUserId + timestamp + type
    const submissionsByUser = await this.submissionRepository.find({
      where: {
        discordUserId,
        type,
      },
    });

    // Filter by Google timestamp in payload JSON
    let matchingSubmission = submissionsByUser.find(
      (s) => s.payloadJson?.googleTimestamp === googleTimestamp,
    );

    if (matchingSubmission) {
      return matchingSubmission;
    }

    // If not found and email is provided, also search by email
    // This handles cases where Player ID changed and discordUserId might be different (temp vs real)
    if (email) {
      // Find all submissions of this type and check payload for matching email + timestamp
      const allSubmissionsOfType = await this.submissionRepository.find({
        where: {
          type,
        },
      });

      matchingSubmission = allSubmissionsOfType.find(
        (s) =>
          s.payloadJson?.googleTimestamp === googleTimestamp &&
          s.payloadJson?.email === email,
      );

      if (matchingSubmission) {
        return matchingSubmission;
      }
    }

    return null;
  }

  /**
   * Find existing all-in-one form submission for a user and build (one form per user per build).
   */
  async findSubmissionByAllInOneBuild(
    discordUserId: string,
    buildVersion: string,
  ): Promise<Submission | null> {
    const submissions = await this.submissionRepository.find({
      where: { discordUserId, type: 'balance_analysis' },
    });
    return (
      submissions.find(
        (s) =>
          s.payloadJson?.allInOneForm === true &&
          s.payloadJson?.buildVersion === buildVersion,
      ) ?? null
    );
  }

  /**
   * Delete a submission by id (used when All-in-One row is removed or cleared in sheet).
   */
  async deleteSubmission(id: string): Promise<void> {
    await this.submissionRepository.delete(id);
  }

  /**
   * Delete All-in-One submissions for a build whose users are not in the given set
   * (e.g. after sync: remove records for users no longer present in the spreadsheet).
   */
  async deleteAllInOneSubmissionsForBuildExceptUsers(
    buildVersion: string,
    discordUserIds: Set<string>,
  ): Promise<number> {
    const submissions = await this.submissionRepository.find({
      where: { type: 'balance_analysis' },
    });
    const toDelete = submissions.filter(
      (s) =>
        s.payloadJson?.allInOneForm === true &&
        s.payloadJson?.buildVersion === buildVersion &&
        !discordUserIds.has(s.discordUserId),
    );
    for (const s of toDelete) {
      await this.submissionRepository.delete(s.id);
    }
    return toDelete.length;
  }
}
