process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

delete process.env.PGHOST;
delete process.env.PGPORT;
delete process.env.PGUSER;
delete process.env.PGPASSWORD;
delete process.env.PGDATABASE;

import { config } from 'dotenv';
import { resolve } from 'path';
import { readFileSync, existsSync } from 'fs';

// Load .env file explicitly BEFORE any other imports (override so .env always wins)
const envPath = resolve(process.cwd(), '.env');
const envPathParent = resolve(process.cwd(), '..', '.env');
console.log('Loading .env from:', envPath);

// Debug: Check if file exists and read raw content
if (existsSync(envPath)) {
  try {
    const rawContent = readFileSync(envPath, 'utf8');
    const formLines = rawContent.split('\n').filter((line) => line.trim().startsWith('FORM_'));
    console.log('Raw .env file - FORM_* lines found:', formLines.length);
    if (formLines.length > 0) {
      console.log('First FORM_ line:', formLines[0].substring(0, 60));
    }
  } catch (e) {
    console.log('Could not read .env file for debug:', e);
  }
}

let envPathLoaded = envPath;
process.env.ENV_FILE_PATH = envPathLoaded; // so config.ts can read same .env path
let result = config({ path: envPath, override: true });
if (result.error && 'code' in result.error && result.error.code === 'ENOENT') {
  result = config({ path: envPathParent, override: true });
  if (!result.error) {
    envPathLoaded = envPathParent;
    process.env.ENV_FILE_PATH = envPathLoaded;
    console.log('Loaded .env from parent dir:', envPathParent);
  }
}
if (result.error) {
  if ('code' in result.error && (result.error as any).code === 'ENOENT') {
    console.log('ℹ️ No .env file found, using environment variables from system');
  } else {
    console.error('❌ Error loading .env file:', result.error);
  }
} else {
  const parsed = result.parsed || {};
  const allKeys = Object.keys(parsed);
  const formKeys = allKeys.filter((k) => k.startsWith('FORM_'));
  console.log('✅ .env file loaded successfully');
  console.log('Total parsed keys:', allKeys.length);
  console.log('Parsed FORM_* keys:', formKeys.length, formKeys.slice(0, 8).join(', ') + (formKeys.length > 8 ? '...' : ''));
  console.log('All parsed keys (first 10):', allKeys.slice(0, 10).join(', '));
  console.log('Sample env vars:', {
    FORM_SCREENSHOT: process.env.FORM_SCREENSHOT ? '✅ LOADED' : '❌ MISSING',
    FORM_BUG_REPRO: process.env.FORM_BUG_REPRO ? '✅ LOADED' : '❌ MISSING',
    DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN ? '✅ LOADED' : '❌ MISSING',
  });
  // Debug: Check if parsed object has FORM_ keys but process.env doesn't
  if (formKeys.length > 0 && !process.env.FORM_SCREENSHOT) {
    console.log('⚠️ WARNING: Parsed has FORM_ keys but process.env does not!');
    console.log('Parsed FORM_SCREENSHOT:', parsed.FORM_SCREENSHOT);
  }
  // Ensure All-in-One per-version vars from .env are in process.env.
  // Dotenv on some systems (e.g. Windows) can omit keys like BUILD_2_12; parse .env raw lines for these.
  try {
    const rawContent = readFileSync(envPathLoaded, 'utf8');
    const applied: string[] = [];
    // Normalize line endings so keys/values never contain stray \r (Windows)
    const lines = rawContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim().replace(/\r/g, '');
      const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '').replace(/\r/g, '');
      // Match any All-in-One key, even if there are hidden characters before the actual prefix.
      const match = key.match(/(GOOGLE_SHEETS_SPREADSHEET_ALL_IN_ONE_BUILD_|FORM_ALL_IN_ONE_BUILD_)[A-Za-z0-9_]+/);
      if (match && key.length > 0) {
        process.env[key] = value;
        applied.push(key);
      }
    }
    console.log('All-in-One raw parse from', envPathLoaded, '→', applied.length, 'keys:', applied.join(', ') || '(none)');
    const id212 = process.env['GOOGLE_SHEETS_SPREADSHEET_ALL_IN_ONE_BUILD_2_12_ID'];
    if (!id212 && applied.length > 0) console.log('⚠️ 2_12 ID still missing in process.env after raw parse');
    else if (id212) console.log('✅ GOOGLE_SHEETS_SPREADSHEET_ALL_IN_ONE_BUILD_2_12_ID set');
  } catch (e) {
    console.log('Could not raw-parse .env for All-in-One:', (e as Error).message, '(path:', envPathLoaded, ')');
  }
}

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

// Global error handlers for auto-restart
process.on('uncaughtException', (error: Error) => {
  console.error('❌ Uncaught Exception:', error);
  console.error('Stack:', error.stack);
  // Don't exit immediately - let the app try to recover
  // In production, PM2 or process manager will restart
});

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  console.error('❌ Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
  // Don't exit immediately - let the app try to recover
});

// Graceful shutdown handler
process.on('SIGTERM', async () => {
  console.log('⚠️ SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('⚠️ SIGINT received, shutting down gracefully...');
  process.exit(0);
});

async function bootstrap() {
  try {
    const app = await NestFactory.create(AppModule, {
      logger: ['error', 'warn', 'log', 'debug', 'verbose'],
    });
    
    // Enable graceful shutdown
    app.enableShutdownHooks();
    
    const port = process.env.PORT || 3000;
    await app.listen(port);
    console.log(`✅ NestJS application is running on port ${port}`);
  } catch (error) {
    console.error('❌ Failed to start application:', error);
    // Exit with error code so process manager can restart
    process.exit(1);
  }
}

bootstrap().catch((error) => {
  console.error('❌ Bootstrap failed:', error);
  process.exit(1);
});
