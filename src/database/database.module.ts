import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Player } from './entities/player.entity';
import { ArmyTester } from './entities/army-tester.entity';
import { WeeklyCycle } from './entities/weekly-cycle.entity';
import { Submission } from './entities/submission.entity';
import { Issue } from './entities/issue.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const dbConfig = configService.get('database');
        const config: any = {
          type: dbConfig.type === 'sqlite' ? 'sqlite' : 'postgres',
          entities: [Player, ArmyTester, WeeklyCycle, Submission, Issue],
          synchronize: process.env.NODE_ENV !== 'production', // Only in dev
          logging: process.env.NODE_ENV === 'development',
        };

        if (dbConfig.type === 'postgres' && dbConfig.url) {
          config.url = dbConfig.url;
          // Explicit SSL configuration for Neon and other cloud providers
          config.ssl = {
            rejectUnauthorized: false, // Required for Neon
          };
        } else if (dbConfig.type === 'sqlite') {
          config.database = dbConfig.path;
        }

        return config;
      },
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([
      Player,
      ArmyTester,
      WeeklyCycle,
      Submission,
      Issue,
    ]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
