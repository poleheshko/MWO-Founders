import { Module, forwardRef } from '@nestjs/common';
import { GoogleSheetsService } from './google-sheets.service';
import { SubmissionModule } from '../submission/submission.module';
import { PlayerModule } from '../player/player.module';
import { TesterArmyModule } from '../tester-army/tester-army.module';
import { CycleModule } from '../cycle/cycle.module';
import { DiscordModule } from '../discord/discord.module';

@Module({
  imports: [
    SubmissionModule,
    PlayerModule,
    TesterArmyModule,
    CycleModule,
    forwardRef(() => DiscordModule),
  ],
  providers: [GoogleSheetsService],
  exports: [GoogleSheetsService],
})
export class GoogleSheetsModule {}
