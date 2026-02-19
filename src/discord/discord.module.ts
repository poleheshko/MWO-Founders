import { Module, forwardRef } from '@nestjs/common';
import { DiscordService } from './discord.service';
import { PlayerModule } from '../player/player.module';
import { TesterArmyModule } from '../tester-army/tester-army.module';
import { SubmissionModule } from '../submission/submission.module';
import { RankModule } from '../rank/rank.module';
import { CycleModule } from '../cycle/cycle.module';
import { GoogleSheetsModule } from '../google-sheets/google-sheets.module';
import { ProfileCommand } from './commands/profile.command';
import { LeaderboardCommand } from './commands/leaderboard.command';
import { RewardCommand } from './commands/reward.command';
import { AdminCommands } from './commands/admin.commands';
import { ParticipateCommand } from './commands/participate.command';
import { DiscordCommandService } from './discord-command.service';

@Module({
  imports: [
    PlayerModule,
    TesterArmyModule,
    SubmissionModule,
    RankModule,
    CycleModule,
    forwardRef(() => GoogleSheetsModule),
  ],
  providers: [
    DiscordService,
    ProfileCommand,
    LeaderboardCommand,
    RewardCommand,
    AdminCommands,
    ParticipateCommand,
    DiscordCommandService,
  ],
  exports: [DiscordService],
})
export class DiscordModule {}
