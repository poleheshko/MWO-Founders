import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { google } from 'googleapis';
import { SubmissionService } from '../submission/submission.service';
import { PlayerService } from '../player/player.service';
import { TesterArmyService } from '../tester-army/tester-army.service';
import { CycleService } from '../cycle/cycle.service';
import { DiscordService } from '../discord/discord.service';
import { QaStatus } from '../database/entities/submission.entity';

/**
 * Gdy w credentials jest "private_key": "NAZWA_ZMIENNEJ" (np. GOOGLE_API_KEY), zwraca wartość z env lub .env.
 * Replit: process.env jest ustawiony z Secrets → używamy go. Lokalnie: fallback na .env z katalogu projektu.
 * Żadnych nowych zmiennych konfiguracyjnych – .env bez zmian.
 */
function resolvePrivateKeyFromEnv(
  envVarName: string,
  serviceAccountKeySource: string,
): string | null {
  if (process.env[envVarName]) return process.env[envVarName] as string;
  // Fallback tylko gdy to ścieżka do pliku (lokalnie). Na Replit = pełny JSON → nie wchodzimy tutaj.
  const src = String(serviceAccountKeySource).trim();
  const isPath = src.length > 0 && !src.startsWith('{') && (src.includes('/') || src.includes('\\') || src.endsWith('.json'));
  if (!isPath) return null;

  const cwd = process.cwd();
  const envPaths: string[] = [
    resolve(cwd, '.env'),
    resolve(cwd, '..', '.env'),
  ];
  try {
    const credPath = resolve(cwd, serviceAccountKeySource);
    envPaths.push(resolve(dirname(dirname(credPath)), '.env'));
  } catch {
    // ignore
  }
  try {
    const mainDir = require.main?.path;
    if (mainDir) envPaths.push(resolve(mainDir, '..', '.env'));
  } catch {
    // ignore
  }

  for (const envPath of envPaths) {
    if (!existsSync(envPath)) continue;
    try {
      const dotenv = require('dotenv');
      dotenv.config({ path: envPath, override: true });
      if (process.env[envVarName]) return process.env[envVarName] as string;
      const result = dotenv.config({ path: envPath });
      if (result.parsed && result.parsed[envVarName]) {
        const v = result.parsed[envVarName];
        if (typeof v === 'string' && v.replace(/\\n/g, '\n').trim().startsWith('-----BEGIN')) return v.replace(/\\n/g, '\n').trim();
      }
    } catch {
      // ignore
    }
    const parsed = parseEnvKeyFromFile(envPath, envVarName);
    if (parsed) return parsed;
  }
  if (envPaths.length > 0) {
    try {
      const fs = require('fs');
      const summary = envPaths.map((p) => ({ path: p, exists: fs.existsSync(p) }));
      console.warn('[GoogleSheets] GOOGLE_API_KEY not resolved. Paths:', JSON.stringify(summary, null, 0));
    } catch {
      // ignore
    }
  }
  return null;
}

function parseEnvKeyFromFile(envPath: string, envVarName: string): string | null {
  try {
    const buf = readFileSync(envPath, 'utf8');
    let raw = buf.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\uFEFF/g, '');
    const key = envVarName.trim();
    const needles = [key + '="', key + ' ="', key + '=\u201C'];
    let start = -1;
    let prefixLen = 0;
    let quoteChar = '"';
    for (const n of needles) {
      start = raw.indexOf(n);
      if (start >= 0) {
        prefixLen = n.length;
        quoteChar = raw[start + prefixLen - 1];
        break;
      }
    }
    if (start >= 0) {
      const valueStart = start + prefixLen;
      let end = valueStart;
      while (end < raw.length) {
        if (raw[end] === '\\') {
          end += 2;
          continue;
        }
        if (raw[end] === quoteChar) break;
        end++;
      }
      if (end > valueStart && end < raw.length) {
        const v = raw.slice(valueStart, end).replace(/\\n/g, '\n').trim();
        if (v.startsWith('-----BEGIN')) return v;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

@Injectable()
export class GoogleSheetsService {
  private readonly logger = new Logger(GoogleSheetsService.name);
  private sheets: any;
  private spreadsheetId: string;
  private range: string;
  private lastProcessedRow: number = 0;

  constructor(
    private readonly configService: ConfigService,
    private readonly submissionService: SubmissionService,
    private readonly playerService: PlayerService,
    private readonly testerArmyService: TesterArmyService,
    private readonly cycleService: CycleService,
    @Inject(forwardRef(() => DiscordService))
    private readonly discordService: DiscordService,
  ) {
    this.initializeSheets();
  }

  private async initializeSheets() {
    try {
      const serviceAccountKey = this.configService.get(
        'googleSheets.serviceAccountKey',
      );
      this.spreadsheetId = this.configService.get(
        'googleSheets.spreadsheetId',
      );
      this.range = this.configService.get('googleSheets.range') || 'Sheet1!A:Z';

      if (!serviceAccountKey || !this.spreadsheetId) {
        this.logger.warn(
          'Google Sheets configuration missing. Survey ingestion disabled.',
        );
        return;
      }

      // Parse service account key (can be JSON string or file path)
      let credentials;
      try {
        credentials = JSON.parse(serviceAccountKey);
      } catch {
        // If not JSON, try as file path
        const fs = require('fs');
        credentials = JSON.parse(fs.readFileSync(serviceAccountKey, 'utf8'));
      }

      if (credentials.private_key) {
        let pk = credentials.private_key;
        if (!pk.startsWith('-----BEGIN')) {
          let resolved =
            resolvePrivateKeyFromEnv(pk.trim(), serviceAccountKey) ||
            resolvePrivateKeyFromEnv('GOOGLE_API_KEY', serviceAccountKey);
          if (!resolved && (pk.includes('/') || pk.includes('\\') || pk.endsWith('.pem') || pk.endsWith('.key'))) {
            const keyPath = resolve(process.cwd(), pk);
            if (existsSync(keyPath)) {
              resolved = readFileSync(keyPath, 'utf8').trim();
            }
          }
          if (resolved) pk = resolved;
        }
        pk = pk.replace(/\\n/g, '\n');
        pk = pk.replace(/\r\n/g, '\n');
        pk = pk.trim();
        if (!pk.startsWith('-----BEGIN')) {
          this.logger.error(`Private key does not start with expected PEM header. First 30 chars: "${pk.substring(0, 30)}"`);
        }
        if (!pk.endsWith('-----')) {
          this.logger.error(`Private key does not end with expected PEM footer. Last 30 chars: "${pk.substring(pk.length - 30)}"`);
        }
        this.logger.log(`Private key format check: starts="${pk.substring(0, 27)}", length=${pk.length}, newlines=${(pk.match(/\n/g) || []).length}`);
        credentials.private_key = pk;
      }

      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      });

      this.sheets = google.sheets({ version: 'v4', auth });
      this.logger.log('Google Sheets API initialized');
    } catch (error) {
      this.logger.error('Failed to initialize Google Sheets:', error);
    }
  }

  async pollNewSubmissions(): Promise<void> {
    if (!this.sheets) {
      return;
    }

    try {
      // Process main spreadsheet (regular submissions)
      if (this.spreadsheetId) {
        const response = await this.sheets.spreadsheets.values.get({
          spreadsheetId: this.spreadsheetId,
          range: this.range,
        });

        const rows = response.data.values;
        if (rows && rows.length > 0) {
          // Parse header row to find column indices
          const headerRow = rows[0];
          const columnMap = this.parseHeaderRow(headerRow);

          // Process all rows (skip header row)
          const dataRows = rows.slice(1);

          for (const row of dataRows) {
            await this.processStructuredReportRow(row, columnMap);
          }

          // Update last processed row count
          this.lastProcessedRow = rows.length - 1;
        }
      }

      // Process structured report build spreadsheets
      const buildSpreadsheets = this.configService.get<Array<{ version: string; spreadsheetId: string }>>('googleSheets.structuredReportBuilds') || [];
      
      for (const build of buildSpreadsheets) {
        if (!build.spreadsheetId) continue;
        
        try {
          this.logger.debug(`Polling structured report spreadsheet for build ${build.version}: ${build.spreadsheetId}`);
          
          const response = await this.sheets.spreadsheets.values.get({
            spreadsheetId: build.spreadsheetId,
            range: 'Form Responses 1!A:Z', // Standard range for Google Forms responses
          });

          const rows = response.data.values;
          if (!rows || rows.length === 0) {
            continue;
          }

          // Parse header row
          const headerRow = rows[0];
          const columnMap = this.parseHeaderRow(headerRow);

          // Process all rows (skip header row)
          const dataRows = rows.slice(1);

          for (const row of dataRows) {
            await this.processStructuredReportBuildRow(row, columnMap, build.version);
          }
        } catch (error) {
          this.logger.error(`Error polling structured report spreadsheet for build ${build.version}:`, error);
          // Continue with other spreadsheets even if one fails
        }
      }

      // Process Record your session spreadsheet
      const recordSessionSpreadsheetId = this.configService.get<string>('googleSheets.recordSessionSpreadsheet');
      
      if (recordSessionSpreadsheetId) {
        try {
          this.logger.debug(`Polling Record your session spreadsheet: ${recordSessionSpreadsheetId}`);
          
          const response = await this.sheets.spreadsheets.values.get({
            spreadsheetId: recordSessionSpreadsheetId,
            range: 'Form Responses 1!A:Z',
          });

          const rows = response.data.values;
          if (rows && rows.length > 0) {
            // Parse header row
            const headerRow = rows[0];
            const columnMap = this.parseHeaderRow(headerRow);

            // Process all rows (skip header row)
            const dataRows = rows.slice(1);

            for (const row of dataRows) {
              await this.processRecordSessionRow(row, columnMap);
            }
          }
        } catch (error) {
          this.logger.error('Error polling Record your session spreadsheet:', error);
          // Continue even if this spreadsheet fails
        }
      }
    } catch (error) {
      this.logger.error('Error polling Google Sheets:', error);
      throw error;
    }
  }

  /**
   * Manually trigger synchronization of Google Sheets
   * Resets the last processed row counter to process all rows
   * Processes both main spreadsheet and all structured report build spreadsheets
   */
  async manualSync(): Promise<void> {
    this.logger.log('Manual synchronization triggered');
    // Reset last processed row to process all rows
    this.lastProcessedRow = 0;
    await this.pollNewSubmissions();
  }

  /**
   * Sync sheet data for a single user by email (admin/testing).
   * Fetches all sheets and processes only rows where email matches (case-insensitive).
   */
  async syncForUserByEmail(email: string): Promise<{ processed: number }> {
    const normalizedEmail = email?.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      throw new Error('Invalid email');
    }
    if (!this.sheets) {
      throw new Error('Google Sheets not initialized');
    }

    let processed = 0;

    try {
      // Main spreadsheet
      if (this.spreadsheetId) {
        const response = await this.sheets.spreadsheets.values.get({
          spreadsheetId: this.spreadsheetId,
          range: this.range,
        });
        const rows = response.data.values;
        if (rows && rows.length > 0) {
          const headerRow = rows[0];
          const columnMap = this.parseHeaderRow(headerRow);
          const dataRows = rows.slice(1);
          for (const row of dataRows) {
            const rowEmail = this.getEmailFromRow(row, columnMap);
            if (rowEmail && rowEmail.trim().toLowerCase() === normalizedEmail) {
              await this.processStructuredReportRow(row, columnMap);
              processed++;
            }
          }
        }
      }

      // Structured report build spreadsheets
      const buildSpreadsheets =
        this.configService.get<Array<{ version: string; spreadsheetId: string }>>(
          'googleSheets.structuredReportBuilds',
        ) || [];
      for (const build of buildSpreadsheets) {
        if (!build.spreadsheetId) continue;
        try {
          const response = await this.sheets.spreadsheets.values.get({
            spreadsheetId: build.spreadsheetId,
            range: 'Form Responses 1!A:Z',
          });
          const rows = response.data.values;
          if (!rows || rows.length === 0) continue;
          const headerRow = rows[0];
          const columnMap = this.parseHeaderRow(headerRow);
          const dataRows = rows.slice(1);
          for (const row of dataRows) {
            const rowEmail = this.getEmailFromRow(row, columnMap);
            if (rowEmail && rowEmail.trim().toLowerCase() === normalizedEmail) {
              await this.processStructuredReportBuildRow(row, columnMap, build.version);
              processed++;
            }
          }
        } catch (err) {
          this.logger.error(
            `Error syncing individual user from structured report build ${build.version}:`,
            err,
          );
        }
      }

      // Record your session spreadsheet
      const recordSessionSpreadsheetId = this.configService.get<string>(
        'googleSheets.recordSessionSpreadsheet',
      );
      if (recordSessionSpreadsheetId) {
        try {
          const response = await this.sheets.spreadsheets.values.get({
            spreadsheetId: recordSessionSpreadsheetId,
            range: 'Form Responses 1!A:Z',
          });
          const rows = response.data.values;
          if (rows && rows.length > 0) {
            const headerRow = rows[0];
            const columnMap = this.parseHeaderRow(headerRow);
            const dataRows = rows.slice(1);
            for (const row of dataRows) {
              const rowEmail = this.getEmailFromRow(row, columnMap);
              if (rowEmail && rowEmail.trim().toLowerCase() === normalizedEmail) {
                await this.processRecordSessionRow(row, columnMap);
                processed++;
              }
            }
          }
        } catch (err) {
          this.logger.error('Error syncing individual user from Record your session:', err);
        }
      }

      this.logger.log(`syncForUserByEmail(${email}): processed ${processed} row(s)`);
      return { processed };
    } catch (error) {
      this.logger.error('Error in syncForUserByEmail:', error);
      throw error;
    }
  }

  /** Extract email from a row using the same logic as process methods (for filtering). */
  private getEmailFromRow(
    row: any[],
    columnMap: Record<string, number>,
  ): string | null {
    let email: string | null = null;
    const emailIndex = columnMap['email'];
    if (emailIndex !== undefined) {
      email = row[emailIndex]?.toString().trim() || null;
    }
    if (!email || !email.includes('@')) {
      for (let i = 0; i < row.length; i++) {
        const val = row[i]?.toString().trim() || '';
        if (val.includes('@') && val.includes('.')) {
          email = val;
          break;
        }
      }
    }
    return email && email.includes('@') ? email : null;
  }

  private parseHeaderRow(headerRow: string[]): Record<string, number> {
    const columnMap: Record<string, number> = {};
    
    headerRow.forEach((header, index) => {
      const normalizedHeader = header?.toString().toLowerCase().trim() || '';
      
      // Map various possible header names to our column names
      if (normalizedHeader.includes('timestamp')) {
        columnMap['timestamp'] = index;
      }
      // Email: "email", "e-mail", "email address", "your email", etc.
      if (
        normalizedHeader.includes('email') ||
        normalizedHeader.includes('e-mail') ||
        normalizedHeader === 'mail'
      ) {
        columnMap['email'] = index;
      }
      if (normalizedHeader.includes('player id') || normalizedHeader.includes('uid')) {
        columnMap['playerId'] = index;
      }
      if (
        normalizedHeader.includes('type of report') ||
        normalizedHeader.includes('report type')
      ) {
        columnMap['reportType'] = index;
      }
      if (normalizedHeader.includes('build version')) {
        columnMap['buildVersion'] = index;
      }
      if (normalizedHeader.includes('before qa approve') || normalizedHeader.includes('qa approve')) {
        columnMap['qaStatus'] = index;
      }
      if (normalizedHeader.includes('qa answer') || normalizedHeader.includes('build will be applied')) {
        columnMap['qaBuildVersion'] = index;
      }
      if (normalizedHeader.includes('points to distribute') || normalizedHeader.includes('points')) {
        columnMap['points'] = index;
      }
      // "HOW MANY POINTS TO ASSIGN?" column for structured report builds
      if (normalizedHeader.includes('how many points') || normalizedHeader.includes('points to assign')) {
        columnMap['pointsToAssign'] = index;
      }
    });

    this.logger.log(
      `Sheet headers parsed: ${JSON.stringify(columnMap)} | raw: [${headerRow.slice(0, 8).map((h) => JSON.stringify(h)).join(', ')}]`,
    );
    return columnMap;
  }

  private async processStructuredReportRow(
    row: any[],
    columnMap: Record<string, number>,
  ): Promise<void> {
    try {
      // Get email from column (primary identifier - consistent across builds)
      let email: string | null = null;
      const emailIndex = columnMap['email'];
      if (emailIndex !== undefined) {
        email = row[emailIndex]?.toString().trim() || null;
      }
      // Fallback: scan row for any value that looks like email (form may use different header)
      if (!email || !email.includes('@')) {
        for (let i = 0; i < row.length; i++) {
          const val = row[i]?.toString().trim() || '';
          if (val.includes('@') && val.includes('.')) {
            email = val;
            break;
          }
        }
      }

      if (!email || !email.includes('@')) {
        this.logger.warn(
          `Row skipped: no valid email found. Header email col: ${emailIndex ?? 'none'}, row[0]: ${JSON.stringify(row[0])}`,
        );
        return;
      }

      // Get Player ID from column (optional, changes per build)
      const playerIdIndex = columnMap['playerId'] ?? 2;
      const identifierStr = row[playerIdIndex]?.toString().trim() || null;
      const identifier = identifierStr && !identifierStr.includes('@') ? identifierStr : null;

      // Resolve email to Discord ID (email is primary identifier)
      const discordUserId = await this.playerService.resolveToDiscordId(
        identifier || email,
        email,
        true, // createIfMissing = true
      );

      if (!discordUserId) {
        this.logger.warn(`Could not resolve email "${email}" to Discord ID.`);
        return;
      }

      let user = await this.playerService.getPlayer(discordUserId);
      if (!user) {
        this.logger.warn(`User not found after resolution: ${discordUserId}`);
        return;
      }

      // Update Player ID (optional) and email if missing
      const updatedPlayer = await this.playerService.updatePlayerFields(
        discordUserId,
        identifier || undefined,
        email,
      );
      if (updatedPlayer && (updatedPlayer.playerId !== user.playerId || updatedPlayer.email !== user.email)) {
        this.logger.log(
          `Updated player ${discordUserId} with Email: ${email}${identifier ? `, Player ID: ${identifier}` : ''}`,
        );
      }

      // Check if user is an active tester (optional - we'll still process the submission)
      const tester = await this.testerArmyService.getTester(discordUserId);
      if (!tester || tester.status !== 'active') {
        this.logger.debug(
          `User ${discordUserId} is not an active tester, but processing submission anyway`,
        );
        // Continue processing - user might be added to tester army later via sync
      }

      // Get report type (column D: "Type of report" - e.g. "Balance Analysis (30 Gems)")
      const reportTypeIndex = columnMap['reportType'] ?? 3;
      const reportTypeStr = row[reportTypeIndex]?.toString().trim() || '';
      const reportTypeLower = reportTypeStr.toLowerCase();

      // Parse points from Type of report if no separate points column: "(30 Gems)" or "(25)" or "(30 TC)" (backward compatible)
      let pointsFromType: number | null = null;
      const tcMatch = reportTypeStr.match(/\((\d+)\s*(?:Gems|TC)?\)/i);
      if (tcMatch) {
        pointsFromType = parseInt(tcMatch[1], 10);
      }

      // Map report type to submission type
      let submissionType: 'bug_repro' | 'bug_video' | 'balance_analysis';
      if (reportTypeLower.includes('balance')) {
        submissionType = 'balance_analysis';
      } else if (reportTypeLower.includes('video')) {
        submissionType = 'bug_video';
      } else {
        submissionType = 'bug_repro';
      }

      // Get QA status
      const qaStatusIndex = columnMap['qaStatus'];
      const qaStatusStr = qaStatusIndex !== undefined 
        ? row[qaStatusIndex]?.toString().trim() || '' 
        : '';

      // Map QA status text to enum
      let qaStatus: QaStatus = null;
      if (qaStatusStr.toLowerCase().includes('qa please check')) {
        qaStatus = 'qa_please_check';
      } else if (qaStatusStr.toLowerCase().includes('no need') && qaStatusStr.toLowerCase().includes('auto')) {
        qaStatus = 'no_need_auto_points';
      } else if (qaStatusStr.toLowerCase().includes('no need') && qaStatusStr.toLowerCase().includes('duplicate')) {
        qaStatus = 'no_need_duplicate';
      }

      // Get QA build version
      const qaBuildVersionIndex = columnMap['qaBuildVersion'];
      const qaBuildVersion = qaBuildVersionIndex !== undefined 
        ? row[qaBuildVersionIndex]?.toString().trim() || null 
        : null;

      // Get points to distribute (from dedicated column or parsed from Type of report)
      const pointsIndex = columnMap['points'];
      const pointsStr = pointsIndex !== undefined 
        ? row[pointsIndex]?.toString().trim() 
        : null;
      let points = pointsStr ? parseInt(pointsStr, 10) : null;
      if (points == null && pointsFromType != null) {
        points = pointsFromType;
      }

      // Get build version from form
      const buildVersionIndex = columnMap['buildVersion'] ?? 4;
      const buildVersion = row[buildVersionIndex]?.toString().trim() || null;

      // Get timestamp
      const timestampIndex = columnMap['timestamp'] ?? 0;
      const timestamp = row[timestampIndex]?.toString().trim() || null;

      // Determine initial status based on QA status
      let initialStatus: 'pending' | 'approved' | 'declined' = 'pending';
      let tcAwarded = 0;

      if (qaStatus === 'no_need_auto_points') {
        // Auto-approve and award points
        initialStatus = 'approved';
        tcAwarded = points || 0;
      } else if (qaStatus === 'qa_please_check') {
        // Wait for QA to enter build version
        initialStatus = 'pending';
        tcAwarded = 0;
      } else if (qaStatus === 'no_need_duplicate') {
        // Don't award points
        initialStatus = 'declined';
        tcAwarded = 0;
      } else {
        // Default: pending
        initialStatus = 'pending';
        tcAwarded = 0;
      }

      // If QA has entered build version for "QA Please Check", approve it
      if (qaStatus === 'qa_please_check' && qaBuildVersion) {
        initialStatus = 'approved';
        tcAwarded = points || 0;
      }

      // Get active cycle
      const activeCycle = await this.cycleService.getActiveCycle();
      const cycleId = activeCycle?.id;

      // Check if submission already exists (by timestamp + player ID + report type)
      // Also check by email if available to handle cases where Player ID changed
      // This allows us to update existing submissions when QA changes status
      const existingSubmission = await this.submissionService.findSubmissionByGoogleTimestamp(
        discordUserId,
        timestamp,
        submissionType,
        email || undefined,
      );

      if (existingSubmission) {
        this.logger.debug(
          `Found existing submission ${existingSubmission.id} for timestamp ${timestamp}, type ${submissionType}, user ${discordUserId}`,
        );

        // If submission was found but has different discordUserId (e.g., temp vs real),
        // update it to the current discordUserId to consolidate submissions
        if (existingSubmission.discordUserId !== discordUserId) {
          const oldDiscordUserId = existingSubmission.discordUserId;
          await this.submissionService.updateSubmissionDiscordUserId(
            existingSubmission.id,
            discordUserId,
          );
          this.logger.log(
            `Updated submission ${existingSubmission.id} discordUserId from ${oldDiscordUserId} to ${discordUserId}`,
          );
        }

        // Update existing submission if QA status or build version changed
        if (
          existingSubmission.qaStatus !== qaStatus ||
          existingSubmission.qaBuildVersion !== qaBuildVersion ||
          (points !== null && existingSubmission.tcProposed !== points)
        ) {
          // Check if build version was just added (was null/empty, now has value)
          const buildVersionJustAdded =
            (!existingSubmission.qaBuildVersion ||
              existingSubmission.qaBuildVersion.trim() === '') &&
            qaBuildVersion &&
            qaBuildVersion.trim() !== '';

          // Update QA status, build version, and points if changed
          await this.submissionService.updateQaStatus(
            existingSubmission.id,
            qaStatus,
            qaBuildVersion,
            points !== null ? points : undefined,
          );

          this.logger.log(
            `Updated structured report submission for user ${discordUserId}, type: ${submissionType}, QA status: ${qaStatus}, build version: ${qaBuildVersion}`,
          );

          // Send notification if build version was just added
          if (buildVersionJustAdded) {
            await this.sendBuildVersionNotification(
              discordUserId,
              qaBuildVersion,
            );
          }
        } else {
          this.logger.debug(
            `No changes detected for submission ${existingSubmission.id}, skipping update`,
          );
        }
      } else {
        // Double-check: search by email + timestamp if email is available
        // This handles edge cases where discordUserId might be different
        let duplicateFound = false;
        if (email) {
          const duplicateByEmail = await this.submissionService.findSubmissionByEmailAndTimestamp(
            email,
            timestamp,
            submissionType,
          );

          if (duplicateByEmail) {
            this.logger.warn(
              `Found duplicate submission by email+timestamp: ${duplicateByEmail.id} (discordUserId: ${duplicateByEmail.discordUserId}), skipping creation`,
            );
            duplicateFound = true;

            // Update discordUserId if different
            if (duplicateByEmail.discordUserId !== discordUserId) {
              await this.submissionService.updateSubmissionDiscordUserId(
                duplicateByEmail.id,
                discordUserId,
              );
            }

            // Also update QA status if changed
            if (
              duplicateByEmail.qaStatus !== qaStatus ||
              duplicateByEmail.qaBuildVersion !== qaBuildVersion ||
              (points !== null && duplicateByEmail.tcProposed !== points)
            ) {
              // Check if build version was just added (was null/empty, now has value)
              const buildVersionJustAdded =
                (!duplicateByEmail.qaBuildVersion ||
                  duplicateByEmail.qaBuildVersion.trim() === '') &&
                qaBuildVersion &&
                qaBuildVersion.trim() !== '';

              await this.submissionService.updateQaStatus(
                duplicateByEmail.id,
                qaStatus,
                qaBuildVersion,
                points !== null ? points : undefined,
              );

              // Send notification if build version was just added
              if (buildVersionJustAdded) {
                await this.sendBuildVersionNotification(
                  discordUserId,
                  qaBuildVersion,
                );
              }
            }
          }
        }

        if (!duplicateFound) {
          // Create new structured report submission
          const newSubmission = await this.submissionService.createStructuredReportSubmission(
            discordUserId,
            submissionType,
            {
              googleTimestamp: timestamp,
              googleRowData: row,
              reportType: reportTypeStr,
              buildVersion,
              qaStatus: qaStatusStr,
              qaBuildVersion,
              pointsToDistribute: points,
              playerId: identifier,
              email: email,
            },
            [],
            cycleId,
            initialStatus,
            points || 0,
            qaStatus,
            qaBuildVersion,
          );

          this.logger.log(
            `Created new structured report submission ${newSubmission.id} for user ${discordUserId}, type: ${submissionType}, timestamp: ${timestamp}, QA status: ${qaStatus}, points: ${tcAwarded}`,
          );

          // Send notification to highlights channel for new submission (show proposed points when awarded is 0)
          await this.sendHighlightNotification(
            discordUserId,
            submissionType,
            tcAwarded,
            points ?? undefined,
          );

          // If build version is already set when creating new submission, send build version notification
          if (qaBuildVersion && qaBuildVersion.trim() !== '') {
            await this.sendBuildVersionNotification(
              discordUserId,
              qaBuildVersion,
            );
          }
        }
      }
    } catch (error) {
      this.logger.error('Error processing structured report row:', error);
      this.logger.debug(`Failed row data: ${JSON.stringify(row)}`);
    }
  }

  /**
   * Process a row from a structured report build spreadsheet (builds 2.10-2.17)
   * These spreadsheets have a "HOW MANY POINTS TO ASSIGN?" column that determines points
   */
  private async processStructuredReportBuildRow(
    row: any[],
    columnMap: Record<string, number>,
    buildVersion: string,
  ): Promise<void> {
    try {
      // Get email from column (primary identifier)
      const emailIndex = columnMap['email'];
      if (emailIndex === undefined) {
        this.logger.warn('No email column found in structured report build spreadsheet');
        return;
      }

      const email = row[emailIndex]?.toString().trim() || '';
      if (!email || !email.includes('@')) {
        this.logger.debug('Skipping row with invalid email');
        return;
      }

      // Get timestamp
      const timestampIndex = columnMap['timestamp'] ?? 0;
      const timestamp = row[timestampIndex]?.toString().trim() || null;

      // Resolve email to Discord ID
      const discordUserId = await this.playerService.resolveToDiscordId(
        email,
        email,
        true, // createIfMissing = true
      );

      if (!discordUserId) {
        this.logger.warn(`Could not resolve email "${email}" to Discord ID for build ${buildVersion}.`);
        return;
      }

      let user = await this.playerService.getPlayer(discordUserId);
      if (!user) {
        this.logger.warn(`User not found after resolution: ${discordUserId}`);
        return;
      }

      // Update Player email if missing
      const updatedPlayer = await this.playerService.updatePlayerFields(
        discordUserId,
        undefined,
        email,
      );
      if (updatedPlayer && updatedPlayer.email !== user.email) {
        this.logger.log(
          `Updated player ${discordUserId} with Email: ${email} for build ${buildVersion}`,
        );
      }

      // Get "HOW MANY POINTS TO ASSIGN?" column (column I)
      const pointsToAssignIndex = columnMap['pointsToAssign'];
      const pointsToAssignStr = pointsToAssignIndex !== undefined 
        ? row[pointsToAssignIndex]?.toString().trim() 
        : null;

      // Parse points: if empty/null → pending with 0 points, if has value → use that value
      let points: number | null = null;
      let status: 'pending' | 'approved' = 'pending';
      let tcAwarded = 0;

      if (pointsToAssignStr && pointsToAssignStr !== '') {
        const parsedPoints = parseInt(pointsToAssignStr, 10);
        if (!isNaN(parsedPoints) && parsedPoints > 0) {
          points = parsedPoints;
          status = 'approved';
          tcAwarded = parsedPoints;
        }
      }

      // If points column is empty, submission stays pending with 0 points
      // (points remains null, status stays 'pending', tcAwarded stays 0)

      // Get active cycle
      const activeCycle = await this.cycleService.getActiveCycle();
      const cycleId = activeCycle?.id;

      // Check if submission already exists (by timestamp + email + build version)
      const existingSubmission = await this.submissionService.findSubmissionByGoogleTimestamp(
        discordUserId,
        timestamp,
        'balance_analysis', // Structured reports use balance_analysis type
        email || undefined,
      );

      if (existingSubmission) {
        this.logger.debug(
          `Found existing structured report submission ${existingSubmission.id} for build ${buildVersion}, timestamp ${timestamp}, user ${discordUserId}`,
        );

        // Update if points assignment changed
        if (points !== null) {
          // Points were assigned - update submission
          const needsUpdate = 
            existingSubmission.tcProposed !== points ||
            existingSubmission.status !== 'approved' ||
            existingSubmission.tcAwarded !== tcAwarded ||
            existingSubmission.qaBuildVersion !== buildVersion;

          if (needsUpdate) {
            await this.submissionService.updateQaStatus(
              existingSubmission.id,
              null, // No QA status for build spreadsheets
              buildVersion,
              points,
            );

            // Update status and awarded points
            await this.submissionService.updateSubmissionStatusAndPoints(
              existingSubmission.id,
              'approved',
              tcAwarded,
            );

            this.logger.log(
              `Updated structured report submission ${existingSubmission.id} for build ${buildVersion}, points: ${points}, status: approved`,
            );
          }
        } else {
          // Points column is empty - keep as pending with 0 points
          // Only update if it was previously approved (shouldn't happen, but handle edge case)
          if (existingSubmission.status !== 'pending' || existingSubmission.tcAwarded !== 0) {
            await this.submissionService.updateSubmissionStatusAndPoints(
              existingSubmission.id,
              'pending',
              0,
            );
            this.logger.log(
              `Reset structured report submission ${existingSubmission.id} for build ${buildVersion} to pending (points column empty)`,
            );
          } else {
            this.logger.debug(
              `Submission ${existingSubmission.id} still pending (no points assigned yet)`,
            );
          }
        }
      } else {
        // Create new submission
        const newSubmission = await this.submissionService.createStructuredReportSubmission(
          discordUserId,
          'balance_analysis', // Structured reports use balance_analysis type
          {
            googleTimestamp: timestamp,
            googleRowData: row,
            buildVersion: buildVersion,
            pointsToAssign: pointsToAssignStr,
            email: email,
            structuredReportBuild: true,
          },
          [],
          cycleId,
          status,
          points || 0,
          null, // No QA status for build spreadsheets
          buildVersion, // Use build version as qaBuildVersion
        );

        this.logger.log(
          `Created new structured report submission ${newSubmission.id} for build ${buildVersion}, user ${discordUserId}, timestamp: ${timestamp}, status: ${status}, points: ${tcAwarded}`,
        );

        // Send notification to highlights channel for new submission
        await this.sendHighlightNotification(
          discordUserId,
          'balance_analysis',
          tcAwarded,
        );
      }
    } catch (error) {
      this.logger.error(`Error processing structured report build row for build ${buildVersion}:`, error);
      this.logger.debug(`Failed row data: ${JSON.stringify(row)}`);
    }
  }

  /**
   * Process a row from Record your session spreadsheet
   * Similar to structured report builds - uses "HOW MANY POINTS TO ASSIGN?" column
   */
  private async processRecordSessionRow(
    row: any[],
    columnMap: Record<string, number>,
  ): Promise<void> {
    try {
      // Get email from column (primary identifier)
      const emailIndex = columnMap['email'];
      if (emailIndex === undefined) {
        this.logger.warn('No email column found in Record your session spreadsheet');
        return;
      }

      const email = row[emailIndex]?.toString().trim() || '';
      if (!email || !email.includes('@')) {
        this.logger.debug('Skipping row with invalid email');
        return;
      }

      // Get timestamp
      const timestampIndex = columnMap['timestamp'] ?? 0;
      const timestamp = row[timestampIndex]?.toString().trim() || null;

      // Resolve email to Discord ID
      const discordUserId = await this.playerService.resolveToDiscordId(
        email,
        email,
        true, // createIfMissing = true
      );

      if (!discordUserId) {
        this.logger.warn(`Could not resolve email "${email}" to Discord ID for Record your session.`);
        return;
      }

      let user = await this.playerService.getPlayer(discordUserId);
      if (!user) {
        this.logger.warn(`User not found after resolution: ${discordUserId}`);
        return;
      }

      // Update Player email if missing
      const updatedPlayer = await this.playerService.updatePlayerFields(
        discordUserId,
        undefined,
        email,
      );
      if (updatedPlayer && updatedPlayer.email !== user.email) {
        this.logger.log(
          `Updated player ${discordUserId} with Email: ${email} for Record your session`,
        );
      }

      // Get "HOW MANY POINTS TO ASSIGN?" column
      const pointsToAssignIndex = columnMap['pointsToAssign'];
      const pointsToAssignStr = pointsToAssignIndex !== undefined 
        ? row[pointsToAssignIndex]?.toString().trim() 
        : null;

      // Parse points: if empty/null → pending with 0 points, if has value → use that value
      let points: number | null = null;
      let status: 'pending' | 'approved' = 'pending';
      let tcAwarded = 0;

      if (pointsToAssignStr && pointsToAssignStr !== '') {
        const parsedPoints = parseInt(pointsToAssignStr, 10);
        if (!isNaN(parsedPoints) && parsedPoints > 0) {
          points = parsedPoints;
          status = 'approved';
          tcAwarded = parsedPoints;
        }
      }

      // Get active cycle
      const activeCycle = await this.cycleService.getActiveCycle();
      const cycleId = activeCycle?.id;

      // Check if submission already exists (by timestamp + email)
      // Use bug_video type for lookup (we use bug_video type but mark with recordSession flag)
      const existingSubmission = await this.submissionService.findSubmissionByGoogleTimestamp(
        discordUserId,
        timestamp,
        'bug_video',
        email || undefined,
      );

      if (existingSubmission) {
        this.logger.debug(
          `Found existing Record your session submission ${existingSubmission.id}, timestamp ${timestamp}, user ${discordUserId}`,
        );

        // Update if points assignment changed
        if (points !== null) {
          // Points were assigned - update submission
          const needsUpdate = 
            existingSubmission.tcProposed !== points ||
            existingSubmission.status !== 'approved' ||
            existingSubmission.tcAwarded !== tcAwarded;

          if (needsUpdate) {
            await this.submissionService.updateQaStatus(
              existingSubmission.id,
              null, // No QA status
              null, // No build version
              points,
            );

            // Update status and awarded points
            await this.submissionService.updateSubmissionStatusAndPoints(
              existingSubmission.id,
              'approved',
              tcAwarded,
            );

            this.logger.log(
              `Updated Record your session submission ${existingSubmission.id}, points: ${points}, status: approved`,
            );
          }
        } else {
          // Points column is empty - keep as pending with 0 points
          if (existingSubmission.status !== 'pending' || existingSubmission.tcAwarded !== 0) {
            await this.submissionService.updateSubmissionStatusAndPoints(
              existingSubmission.id,
              'pending',
              0,
            );
            this.logger.log(
              `Reset Record your session submission ${existingSubmission.id} to pending (points column empty)`,
            );
          } else {
            this.logger.debug(
              `Submission ${existingSubmission.id} still pending (no points assigned yet)`,
            );
          }
        }
      } else {
        // Create new submission
        // Use bug_video type (will be displayed as "Record your session" via payload.recordSession flag)
        const newSubmission = await this.submissionService.createStructuredReportSubmission(
          discordUserId,
          'bug_video',
          {
            googleTimestamp: timestamp,
            googleRowData: row,
            pointsToAssign: pointsToAssignStr,
            email: email,
            recordSession: true,
            reason: 'Record your session',
          },
          [],
          cycleId,
          status,
          points || 0,
          null, // No QA status
          null, // No build version
        );

        // Update status and points if they don't match (createStructuredReportSubmission may set different defaults)
        if (newSubmission.status !== status || newSubmission.tcAwarded !== tcAwarded) {
          await this.submissionService.updateSubmissionStatusAndPoints(
            newSubmission.id,
            status,
            tcAwarded,
          );
        }

        this.logger.log(
          `Created new Record your session submission ${newSubmission.id}, user ${discordUserId}, timestamp: ${timestamp}, status: ${status}, points: ${tcAwarded}`,
        );

        // Send notification to highlights channel for new submission
        await this.sendHighlightNotification(
          discordUserId,
          'bug_video',
          tcAwarded,
        );
      }
    } catch (error) {
      this.logger.error('Error processing Record your session row:', error);
      this.logger.debug(`Failed row data: ${JSON.stringify(row)}`);
    }
  }

  /**
   * Send notification to highlights channel when a new submission is created.
   * Includes +Gems and a leaderboard snippet around the user's rank.
   * When pointsAwarded is 0 (e.g. pending QA), displays pointsProposed so the message doesn't show "+0 awarded".
   */
  private async sendHighlightNotification(
    discordUserId: string,
    submissionType: 'bug_repro' | 'bug_video' | 'balance_analysis',
    pointsAwarded: number = 15,
    pointsProposed?: number,
  ): Promise<void> {
    try {
      // Don't send a highlight when there are no points to show (avoids "+0 awarded" for pending Balance Analysis build rows, etc.)
      const hasPointsToShow = pointsAwarded > 0 || (pointsProposed != null && pointsProposed > 0);
      if (!hasPointsToShow) {
        this.logger.debug(
          `Skipping highlight notification for user ${discordUserId}, type: ${submissionType} (no points awarded or proposed)`,
        );
        return;
      }

      const highlightsChannelId = this.configService.get(
        'discord.channels.highlights',
      );

      if (!highlightsChannelId) {
        this.logger.warn(
          'CHANNEL_HIGHLIGHTS not configured, skipping notification',
        );
        return;
      }

      const gem = this.discordService.getGemEmoji();

      // Map submission type to readable English text
      const submissionTypeMap: Record<
        'bug_repro' | 'bug_video' | 'balance_analysis',
        string
      > = {
        bug_repro: 'Bug Reproduction Report',
        bug_video: 'Bug Video Report',
        balance_analysis: 'Balance Analysis Report',
      };

      const submissionTypeText = submissionTypeMap[submissionType] || submissionType;
      const displayPoints = pointsAwarded > 0 ? pointsAwarded : (pointsProposed ?? pointsAwarded);

      let message = `📊 **New Feedback Submitted**\n\n`;
      message += `Founder <@${discordUserId}> shared a **${submissionTypeText}**\n`;
      message += `+${displayPoints} ${gem} awarded\n\n`;

      const snippet = await this.submissionService.getLeaderboardSnippetForUser(
        discordUserId,
        gem,
      );
      if (snippet) {
        message += `🏆 **Feedback Leaderboard**\n${snippet}\n\n`;
      }

      message += `Thank you for helping us shape Monopoly World.`;

      await this.discordService.sendToChannel(highlightsChannelId, message);
      this.logger.log(
        `Sent highlight notification for user ${discordUserId}, type: ${submissionType}`,
      );
    } catch (error) {
      this.logger.error(
        `Error sending highlight notification for user ${discordUserId}:`,
        error,
      );
      // Don't throw - we don't want to fail the entire sync if notification fails
    }
  }

  /**
   * Send notification to highlights channel when QA adds build version
   */
  private async sendBuildVersionNotification(
    discordUserId: string,
    buildVersion: string,
  ): Promise<void> {
    try {
      const highlightsChannelId = this.configService.get(
        'discord.channels.highlights',
      );

      if (!highlightsChannelId) {
        this.logger.warn(
          'CHANNEL_HIGHLIGHTS not configured, skipping notification',
        );
        return;
      }

      // Format message: Thanks to player @discord_id, in build [build version], a fix will appear. Thank you for helping us shape our game.
      const message = `Thanks to player <@${discordUserId}>, in build **${buildVersion}**, a fix will appear. Thank you for helping us shape our game! 🎉`;

      await this.discordService.sendToChannel(highlightsChannelId, message);
      this.logger.log(
        `Sent build version notification for user ${discordUserId}, build: ${buildVersion}`,
      );
    } catch (error) {
      this.logger.error(
        `Error sending build version notification for user ${discordUserId}:`,
        error,
      );
      // Don't throw - we don't want to fail the entire sync if notification fails
    }
  }

  // Keep old method for backward compatibility (surveys)
  private async processSurveyRow(row: any[]): Promise<void> {
    try {
      const timestamp = row[0];
      const discordUserIdStr = row[1];

      if (!discordUserIdStr) {
        this.logger.warn(`Row missing discord_user_id: ${timestamp}`);
        return;
      }

      const discordUserId = discordUserIdStr.toString().trim();

      if (!/^\d+$/.test(discordUserId)) {
        this.logger.warn(
          `Row contains non-numeric value in discord_user_id column (likely email): "${discordUserId}". Skipping row.`,
        );
        return;
      }

      const user = await this.playerService.getUser(discordUserId);
      if (!user) {
        this.logger.warn(`User not found: ${discordUserId}`);
        return;
      }

      const tester = await this.testerArmyService.getTester(discordUserId);
      if (!tester || tester.status !== 'active') {
        this.logger.warn(`User ${discordUserId} is not an active tester`);
        return;
      }

      const activeCycle = await this.cycleService.getActiveCycle();
      const cycleId = activeCycle?.id;

      await this.submissionService.createSubmission(
        discordUserId,
        'survey',
        {
          googleTimestamp: timestamp,
          googleRowData: row,
        },
        [],
        cycleId,
        'approved',
      );

      this.logger.log(`Processed survey submission for user ${discordUserId}`);
    } catch (error) {
      this.logger.error('Error processing survey row:', error);
      this.logger.debug(`Failed row data: ${JSON.stringify(row)}`);
    }
  }
}
