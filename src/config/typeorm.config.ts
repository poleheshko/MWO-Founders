import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { resolve } from 'path';
import { config as appConfig } from './config';
import { Player } from '../database/entities/player.entity';
import { ArmyTester } from '../database/entities/army-tester.entity';
import { WeeklyCycle } from '../database/entities/weekly-cycle.entity';
import { Submission } from '../database/entities/submission.entity';
import { Issue } from '../database/entities/issue.entity';

// Load .env file explicitly for migrations CLI
const envPath = resolve(process.cwd(), '.env');
config({ path: envPath, override: true });

const dbConfig = appConfig();

// Build DataSource configuration
const dataSourceConfig: any = {
  type: dbConfig.database.type === 'sqlite' ? 'sqlite' : 'postgres',
  url: dbConfig.database.type === 'postgres' ? dbConfig.database.url : undefined,
  database: dbConfig.database.type === 'sqlite' ? dbConfig.database.path : undefined,
  entities: [Player, ArmyTester, WeeklyCycle, Submission, Issue],
  synchronize: false, // Use migrations in production
  logging: process.env.NODE_ENV === 'development',
  migrations: ['dist/migrations/*.js'],
  migrationsRun: false,
};

// Add SSL configuration for Neon and other cloud PostgreSQL providers
if (dbConfig.database.type === 'postgres' && dbConfig.database.url?.includes('neon.tech')) {
  dataSourceConfig.ssl = {
    rejectUnauthorized: false,
  };
}

export const AppDataSource = new DataSource(dataSourceConfig);
