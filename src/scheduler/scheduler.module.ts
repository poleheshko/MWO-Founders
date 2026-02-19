import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { GoogleSheetsModule } from '../google-sheets/google-sheets.module';
import { DiscordModule } from '../discord/discord.module';
import { CycleModule } from '../cycle/cycle.module';
import { SubmissionModule } from '../submission/submission.module';
import { TesterArmyModule } from '../tester-army/tester-army.module';

@Module({
  imports: [
    GoogleSheetsModule,
    DiscordModule,
    CycleModule,
    SubmissionModule,
    TesterArmyModule,
  ],
  providers: [SchedulerService],
})
export class SchedulerModule {}
