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
  tc: {
    quickTest: parseInt(process.env.TC_QUICK_TEST || '10', 10),
    survey: parseInt(process.env.TC_SURVEY || '3', 10),
    screenshot: parseInt(process.env.TC_SCREENSHOT || '5', 10),
    bugRepro: parseInt(process.env.TC_BUG_REPRO || '25', 10),
    bugVideo: parseInt(process.env.TC_BUG_VIDEO || '40', 10),
    balanceAnalysis: parseInt(process.env.TC_BALANCE_ANALYSIS || '30', 10),
    retest: parseInt(process.env.TC_RETEST || '15', 10),
    shippedBonus: parseInt(process.env.TC_SHIPPED_BONUS || '100', 10),
  },
  ranks: {
    explorer: {
      tc: parseInt(process.env.RANK_EXPLORER_TC || '60', 10),
    },
    testPilot: {
      tc: parseInt(process.env.RANK_TEST_PILOT_TC || '250', 10),
    },
    foundersCircle: {
      tc: parseInt(process.env.RANK_FOUNDERS_CIRCLE_TC || '900', 10),
      topN: parseInt(process.env.RANK_FOUNDERS_CIRCLE_TOP_N || '15', 10),
    },
  },
  rateLimit: {
    submitPerHour: parseInt(process.env.RATE_LIMIT_SUBMIT_PER_HOUR || '10', 10),
  },
  build: {
    maxTcPerBuild: parseInt(process.env.BUILD_MAX_TC_PER_USER || '200', 10),
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
  },
});
