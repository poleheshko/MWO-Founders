import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { GoogleSheetsService } from '../google-sheets/google-sheets.service';
import { DiscordService } from '../discord/discord.service';
import { ConfigService } from '@nestjs/config';
import { CycleService } from '../cycle/cycle.service';
import { SubmissionService } from '../submission/submission.service';
import { TesterArmyService } from '../tester-army/tester-army.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly googleSheetsService: GoogleSheetsService,
    private readonly discordService: DiscordService,
    private readonly configService: ConfigService,
    private readonly cycleService: CycleService,
    private readonly submissionService: SubmissionService,
    private readonly testerArmyService: TesterArmyService,
  ) {}

  /**
   * Google Sheets sync schedule:
   * - Fri 10:00 – Mon 10:00: every hour (weekend testing window)
   * - Rest of the week: every 6 hours (00:00, 06:00, 12:00, 18:00)
   */
  @Cron('0 * * * *') // Every hour at :00
  async pollGoogleSheets() {
    const now = new Date();
    const day = now.getDay(); // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat (server local time)
    const hour = now.getHours();

    const isWeekendWindow =
      (day === 5 && hour >= 10) || // Fri from 10:00
      day === 6 || // Sat
      day === 0 || // Sun
      (day === 1 && hour <= 10); // Mon up to 10:00 inclusive (10:00 is last hourly)

    if (isWeekendWindow) {
      this.logger.debug('Polling Google Sheets (hourly – weekend window)');
      await this.googleSheetsService.pollNewSubmissions();
      return;
    }

    const sixHourSlots = [0, 6, 12, 18];
    if (sixHourSlots.includes(hour)) {
      this.logger.debug('Polling Google Sheets (every 6h – weekday)');
      await this.googleSheetsService.pollNewSubmissions();
    }
  }

  // Wednesday reminder
  @Cron('0 12 * * 3') // Every Wednesday at 12:00
  async wednesdayReminder() {
    const activeBuild = await this.cycleService.getActiveCycle();
    if (!activeBuild) return;

    const announcementsChannelId = this.configService.get(
      'discord.channels.announcements',
    );
    if (announcementsChannelId) {
      const message =
        '📊 **Mid-Build Check-in!**\n\n' +
        `How is testing going with **${activeBuild.buildVersion}**? Use \`/participate\` to get links to submit your contributions!`;
      await this.discordService.sendToChannel(announcementsChannelId, message);
    }
  }

  // Friday reminder (no fixed deadline - build ends when next is launched)
  @Cron('0 18 * * 5') // Every Friday at 18:00
  async fridayReminder() {
    const activeBuild = await this.cycleService.getActiveCycle();
    if (!activeBuild) return;

    const announcementsChannelId = this.configService.get(
      'discord.channels.announcements',
    );
    if (announcementsChannelId) {
      const message =
        '📊 **Weekend Testing!**\n\n' +
        `Keep testing **${activeBuild.buildVersion}** and submit your contributions! Use \`/participate\` to get links.`;
      await this.discordService.sendToChannel(announcementsChannelId, message);
    }
  }

  // Sunday build report (no auto-close - build ends when next is launched)
  @Cron('0 12 * * 0') // Every Sunday at 12:00
  async sundayBuildReport() {
    const activeBuild = await this.cycleService.getActiveCycle();
    if (!activeBuild) return;

    const leaderboard = await this.submissionService.getLeaderboard(
      'week',
      activeBuild.id,
      10,
    );

    const announcementsChannelId = this.configService.get(
      'discord.channels.announcements',
    );
    if (announcementsChannelId) {
      const leaderboardText =
        leaderboard.length > 0
          ? leaderboard
              .map(
                (entry, index) =>
                  `${index + 1}. **${entry.username}** - ${entry.totalTc} <:gem:1>`,
              )
              .join('\n')
          : 'No submissions for this build yet.';

      const message =
        `📊 **Build Report - ${activeBuild.buildVersion}**\n\n` +
        `**Top Contributors:**\n${leaderboardText}\n\n` +
        `Great work everyone! Keep testing until the next build launches. 🎉`;

      await this.discordService.sendToChannel(announcementsChannelId, message);
    }
  }

  // Nightly membership sync (safety net)
  @Cron('0 2 * * *') // Every day at 2:00 AM
  async nightlyMembershipSync() {
    this.logger.log('Running nightly membership sync');
    try {
      const result = await this.discordService.syncAllMembers();
      this.logger.log(
        `Nightly sync complete: ${result.added} added, ${result.updated} updated, ${result.total} total members`,
      );
    } catch (error) {
      this.logger.error('Error in nightly membership sync:', error);
    }
  }
}
