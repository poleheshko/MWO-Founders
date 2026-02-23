import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DiscordModule } from './discord/discord.module';
import { DatabaseModule } from './database/database.module';
import { PlayerModule } from './player/player.module';
import { TesterArmyModule } from './tester-army/tester-army.module';
import { SubmissionModule } from './submission/submission.module';
import { CycleModule } from './cycle/cycle.module';
import { GoogleSheetsModule } from './google-sheets/google-sheets.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { HealthController } from './health.controller';
import { config } from './config/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [config],
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    DiscordModule,
    PlayerModule,
    TesterArmyModule,
    SubmissionModule,
    CycleModule,
    GoogleSheetsModule,
    SchedulerModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
