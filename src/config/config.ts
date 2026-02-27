import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

export const config = () => ({
  discord: {
    token: process.env.DISCORD_BOT_TOKEN,
    guildId: process.env.DISCORD_GUILD_ID,
    channels: {
      announcements: process.env.CHANNEL_ANNOUNCEMENTS,
      highlights: process.env.CHANNEL_HIGHLIGHTS,
      adminLogs: process.env.CHANNEL_ADMIN_LOGS,
    },
  },
  database: {
    url: process.env.DATABASE_URL,
    type: process.env.DATABASE_TYPE || 'postgres',
    path: process.env.DATABASE_PATH,
  },
  program: {
    roles: (process.env.PROGRAM_ROLES || 'Tester Recruit,Explorer,Test Pilot,Founders Circle').split(','),
  },
  gems: {
    quickTest: parseInt(process.env.GEMS_QUICK_TEST || '10', 10),
    survey: parseInt(process.env.GEMS_SURVEY || '3', 10),
    screenshot: parseInt(process.env.GEMS_SCREENSHOT || '5', 10),
    bugRepro: parseInt(process.env.GEMS_BUG_REPRO || '25', 10),
    bugVideo: parseInt(process.env.GEMS_BUG_VIDEO || '40', 10),
    balanceAnalysis: parseInt(process.env.GEMS_BALANCE_ANALYSIS || '30', 10),
    retest: parseInt(process.env.GEMS_RETEST || '15', 10),
    shippedBonus: parseInt(process.env.GEMS_SHIPPED_BONUS || '100', 10),
  },
  ranks: {
    explorer: {
      gems: parseInt(process.env.RANK_EXPLORER_GEMS || '60', 10),
    },
    testPilot: {
      gems: parseInt(process.env.RANK_TEST_PILOT_GEMS || '250', 10),
    },
    foundersCircle: {
      gems: parseInt(process.env.RANK_FOUNDERS_CIRCLE_GEMS || '900', 10),
      topN: parseInt(process.env.RANK_FOUNDERS_CIRCLE_TOP_N || '15', 10),
    },
  },
  rateLimit: {
    submitPerHour: parseInt(process.env.RATE_LIMIT_SUBMIT_PER_HOUR || '10', 10),
  },
  build: {
    maxGemsPerBuild: parseInt(process.env.BUILD_MAX_GEMS_PER_USER || '1000', 10),
  },
  googleSheets: {
    spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
    range: process.env.GOOGLE_SHEETS_RANGE || 'Sheet1!A:Z',
    serviceAccountKey: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
    structuredReportBuilds: process.env.GOOGLE_SHEETS_STRUCTURED_REPORT_BUILDS
      ? (() => {
          try {
            // Try JSON format first
            const parsed = JSON.parse(process.env.GOOGLE_SHEETS_STRUCTURED_REPORT_BUILDS);
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            // Fallback to colon-separated format: "version:spreadsheet_id,version:spreadsheet_id,..."
            return process.env.GOOGLE_SHEETS_STRUCTURED_REPORT_BUILDS.split(',')
              .map((entry) => {
                const trimmed = entry.trim();
                // Split only on the first colon
                const colonIndex = trimmed.indexOf(':');
                if (colonIndex === -1) return null;
                
                const version = trimmed.substring(0, colonIndex).trim();
                const spreadsheetId = trimmed.substring(colonIndex + 1).trim();
                return version && spreadsheetId ? { version, spreadsheetId } : null;
              })
              .filter((entry) => entry !== null);
          }
        })()
      : [],
    recordSessionSpreadsheet: process.env.GOOGLE_SHEETS_RECORD_SESSION_SPREADSHEET_ID || null,
    // All-in-one build spreadsheets (one long form per build with ID-FSR, ID-IF, ID-S, ID-V, ID-SR columns)
    // Prefer per-version env vars (2_11, 2_12, …) so .env with GOOGLE_SHEETS_SPREADSHEET_ALL_IN_ONE_BUILD_2_XX_ID always wins
    allInOneBuilds: ((): Array<{ version: string; spreadsheetId: string }> => {
      const versions = ['2.11', '2.12', '2.13', '2.14', '2.15', '2.16', '2.17'];
      const fromPerVersion: Array<{ version: string; spreadsheetId: string }> = [];
      for (const v of versions) {
        const keyUnderscore = `GOOGLE_SHEETS_SPREADSHEET_ALL_IN_ONE_BUILD_${v.replace('.', '_')}_ID`;
        const keyDot = `GOOGLE_SHEETS_SPREADSHEET_ALL_IN_ONE_BUILD_${v}_ID`;
        const raw = process.env[keyUnderscore] ?? process.env[keyDot] ?? '';
        const id = (typeof raw === 'string' ? raw : String(raw)).trim().replace(/^["']|["']$/g, '');
        if (id && id !== '[PLACEHOLDER]') fromPerVersion.push({ version: v, spreadsheetId: id });
      }
      // Fallback: read .env directly for All-in-One IDs (use same path as main.ts when set)
      const envPath = process.env.ENV_FILE_PATH || resolve(process.cwd(), '.env');
      const addedFromFile: string[] = [];
      if (existsSync(envPath)) {
        try {
          const raw = readFileSync(envPath, 'utf8');
          const lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            // Only treat lines that look like KEY=value (skip multi-line value continuation)
            if (!/^[A-Za-z_][A-Za-z0-9_]*=/.test(trimmed)) continue;
            const eq = trimmed.indexOf('=');
            if (eq <= 0) continue;
            const key = trimmed.slice(0, eq).trim().replace(/\r/g, '');
            // Match keys like GOOGLE_SHEETS_SPREADSHEET_ALL_IN_ONE_BUILD_2_12_ID even if they have hidden chars.
            const keyMatch = key.match(/GOOGLE_SHEETS_SPREADSHEET_ALL_IN_ONE_BUILD_([0-9_]+)_ID/);
            if (!keyMatch) continue;
            const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '').replace(/\r/g, '');
            if (!value || value === '[PLACEHOLDER]') continue;
            const verPart = keyMatch[1];
            const version = verPart.replace(/_/g, '.');
            if (versions.includes(version) && !fromPerVersion.some((e) => e.version === version)) {
              fromPerVersion.push({ version, spreadsheetId: value });
              addedFromFile.push(version);
            }
          }
          fromPerVersion.sort((a, b) => a.version.localeCompare(b.version));
          if (addedFromFile.length > 0) {
            console.log('[Config] All-in-One spreadsheets: added from .env file:', addedFromFile.join(', '), '| path:', envPath);
          }
        } catch (e) {
          console.warn('[Config] Could not read .env for All-in-One fallback:', (e as Error).message, '| path:', envPath);
        }
      } else if (fromPerVersion.length > 0) {
        console.log('[Config] All-in-One: .env not found at', envPath, '(using process.env only)');
      }
      if (fromPerVersion.length > 0) return fromPerVersion;
      const list = process.env.GOOGLE_SHEETS_ALL_IN_ONE_BUILDS;
      if (list) {
        return list.split(',')
          .map((entry) => {
            const trimmed = entry.trim();
            const colonIndex = trimmed.indexOf(':');
            if (colonIndex === -1) return null;
            const version = trimmed.substring(0, colonIndex).trim();
            const spreadsheetId = trimmed.substring(colonIndex + 1).trim();
            return version && spreadsheetId ? { version, spreadsheetId } : null;
          })
          .filter((e): e is { version: string; spreadsheetId: string } => e !== null);
      }
      return [];
    })(),
    allInOneRange: process.env.GOOGLE_SHEETS_RANGE || 'Form Responses 1!A:ZZ',
  },
  forms: {
    screenshot: process.env.FORM_SCREENSHOT,
    bugRepro: process.env.FORM_BUG_REPRO,
    bugVideo: process.env.FORM_BUG_VIDEO,
    balanceAnalysis: process.env.FORM_BALANCE_ANALYSIS,
    retest: process.env.FORM_RETEST,
    recordSession: process.env.FORM_RECORD_SESSION,
    structuredReport: process.env.FORM_STRUCTURED_REPORT,
    structuredReportLinks: process.env.FORM_STRUCTURED_REPORT_LINKS
      ? process.env.FORM_STRUCTURED_REPORT_LINKS.split(',').map((link) => link.trim())
      : [],
    structuredReportBuilds: process.env.FORM_STRUCTURED_REPORT_BUILDS
      ? (() => {
          try {
            // Try JSON format first
            const parsed = JSON.parse(process.env.FORM_STRUCTURED_REPORT_BUILDS);
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            // Fallback to colon-separated format: "2.10:url,2.11:url,..."
            return process.env.FORM_STRUCTURED_REPORT_BUILDS.split(',')
              .map((entry) => {
                const trimmed = entry.trim();
                // Split only on the first colon (to handle URLs with ://)
                const colonIndex = trimmed.indexOf(':');
                if (colonIndex === -1) return null;
                
                const version = trimmed.substring(0, colonIndex).trim();
                const formUrl = trimmed.substring(colonIndex + 1).trim();
                return version && formUrl ? { version, formUrl } : null;
              })
              .filter((entry) => entry !== null);
          }
        })()
      : [],
    recordSessionSpreadsheet: process.env.GOOGLE_SHEETS_RECORD_SESSION_SPREADSHEET_ID || null,
    // All-in-one form URLs per build (same format as structuredReportBuilds)
    allInOneBuilds: ((): Array<{ version: string; formUrl: string }> => {
      const list = process.env.FORM_ALL_IN_ONE_BUILDS;
      if (list) {
        return list.split(',')
          .map((entry) => {
            const trimmed = entry.trim();
            const colonIndex = trimmed.indexOf(':');
            if (colonIndex === -1) return null;
            const version = trimmed.substring(0, colonIndex).trim();
            const formUrl = trimmed.substring(colonIndex + 1).trim();
            return version && formUrl ? { version, formUrl } : null;
          })
          .filter((e): e is { version: string; formUrl: string } => e !== null);
      }
      // Fallback: per-version env vars FORM_ALL_IN_ONE_BUILD_2_XX_LINK (2.11–2.17)
      const versions = ['2.11', '2.12', '2.13', '2.14', '2.15', '2.16', '2.17'];
      const result: Array<{ version: string; formUrl: string }> = [];
      for (const v of versions) {
        const keyUnderscore = `FORM_ALL_IN_ONE_BUILD_${v.replace('.', '_')}_LINK`;
        const keyDot = `FORM_ALL_IN_ONE_BUILD_${v.replace('_', '.')}_LINK`;
        const raw = process.env[keyUnderscore] ?? process.env[keyDot] ?? '';
        const link = (typeof raw === 'string' ? raw : String(raw)).trim().replace(/^["']|["']$/g, '');
        if (link && link !== '[PLACEHOLDER]') result.push({ version: v, formUrl: link });
      }
      // Fallback: read .env for FORM_ALL_IN_ONE_BUILD_*_LINK (same path as main)
      const envPathForms = process.env.ENV_FILE_PATH || resolve(process.cwd(), '.env');
      if (existsSync(envPathForms)) {
        try {
          const raw = readFileSync(envPathForms, 'utf8');
          const lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            if (!/^[A-Za-z_][A-Za-z0-9_]*=/.test(trimmed)) continue;
            const eq = trimmed.indexOf('=');
            if (eq <= 0) continue;
            const key = trimmed.slice(0, eq).trim().replace(/\r/g, '');
            const keyMatch = key.match(/FORM_ALL_IN_ONE_BUILD_([0-9_]+)_LINK/);
            if (!keyMatch) continue;
            const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '').replace(/\r/g, '');
            if (!value || value === '[PLACEHOLDER]') continue;
            const verPart = keyMatch[1];
            const version = verPart.replace(/_/g, '.');
            if (versions.includes(version) && !result.some((e) => e.version === version)) {
              result.push({ version, formUrl: value });
            }
          }
          result.sort((a, b) => a.version.localeCompare(b.version));
        } catch {
          // ignore
        }
      }
      return result;
    })(),
  },
});
