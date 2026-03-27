// backend/services/cdr-auto-fetch.js
require('dotenv').config();
const cron       = require('node-cron');
const { exec }   = require('child_process');
const util       = require('util');
const fs         = require('fs');
const path       = require('path');
const Papa       = require('papaparse');
const CDR        = require('../models/CDR');
const sequelize  = require('../models/db');
const { getGlobalSettings, updateGlobalSettings } = require('./system-settings');
const { createNotification }                       = require('./notification-service');

// ─── Structured logger ───────────────────────────────────────────────────────
const log = {
  info:  (msg, meta = {}) => console.log(JSON.stringify({ level: 'info',  msg, ...meta, ts: new Date().toISOString() })),
  warn:  (msg, meta = {}) => console.warn(JSON.stringify({ level: 'warn',  msg, ...meta, ts: new Date().toISOString() })),
  error: (msg, meta = {}) => console.error(JSON.stringify({ level: 'error', msg, ...meta, ts: new Date().toISOString() })),
};

// ─── Constants ────────────────────────────────────────────────────────────────
const CDR_COLUMNS = [
  'callere164', 'calleraccesse164', 'calleee164', 'calleeaccesse164',
  'callerip', 'callercodec', 'callergatewayid', 'callerproductid',
  'callertogatewaye164', 'callertype', 'calleeip', 'calleecodec',
  'calleegatewayid', 'calleeproductid', 'calleetogatewaye164',
  'calleetype', 'billingmode', 'calllevel', 'agentfeetime',
  'starttime', 'stoptime', 'callerpdd', 'calleepdd', 'holdtime',
  'callerareacode', 'feetime', 'fee', 'tax', 'suitefee',
  'suitefeetime', 'incomefee', 'incometax', 'customeraccount',
  'customername', 'calleeareacode', 'agentfee', 'agenttax',
  'agentsuitefee', 'agentsuitefeetime', 'agentaccount', 'agentname',
  'flowno', 'softswitchname', 'softswitchcallid', 'callercallid',
  'calleroriginalcallid', 'rtpforward', 'enddirection', 'endreason',
  'billingtype', 'cdrlevel', 'agentcdr_id',
];

// Only allow safe CDR filenames — prevents shell injection via remote paths
const SAFE_FILENAME_RE = /^cdr_\d{8}_\d{6}\.csv$/i;

const execPromise = util.promisify(exec);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Parse UTC timestamp from CDR filename: cdr_YYYYMMDD_HHMMSS.csv
 * Returns ISO string or null.
 */
const parseCdrFilenameUtc = (filename = '') => {
  const match = String(filename).match(/^cdr_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})\.csv$/i);
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match;
  const utcDate = new Date(Date.UTC(
    Number(year), Number(month) - 1, Number(day),
    Number(hour), Number(minute), Number(second),
  ));
  return Number.isNaN(utcDate.getTime()) ? null : utcDate.toISOString();
};

// ─── Main class ───────────────────────────────────────────────────────────────

class CDRAutoFetcher {
  constructor(config = {}) {
    const maxBufferMB = Number(process.env.CDR_MAX_BUFFER_MB) || 25;

    this.config = {
      serverIP:      process.env.SERVER_IP,
      serverPath:    process.env.SERVER_PATH,
      username:      process.env.SSH_USERNAME,
      sshPort:       parseInt(process.env.SSH_PORT, 10),
      sshKeyPath:    process.env.SSH_KEY_PATH,
      filePattern:   'cdr_*.csv',
      fetchInterval: '*/15 * * * *',
      maxRetries:    3,
      maxBufferBytes: maxBufferMB * 1024 * 1024,
      // 1-hour cooldown between "no files found" notifications
      missingFilesNotifyCooldownMs: 60 * 60 * 1000,
      ...config,
    };

    this.isRunning                      = false;
    this.lastProcessedFilename          = '';
    this.lastProcessedTimestampUtc      = '';
    this.lastProcessedTimestampMs       = Number.NaN;
    this.lastMissingFilesNotificationAt = 0;

    this.init().catch((error) => {
      log.error('Failed to initialize CDR Auto-Fetcher', { error: error.message });
    });
  }

  // ── Initialization ──────────────────────────────────────────────────────────

  async init() {
    await sequelize.authenticate();
    await this.loadProcessingCheckpoint();
    this.startScheduler();
    log.info('CDR Auto-Fetcher initialized');
  }

  async loadProcessingCheckpoint() {
    try {
      const settings      = await getGlobalSettings();
      const filename      = settings?.lastProcessedCdrFilename     || '';
      const timestampUtc  = settings?.lastProcessedCdrTimestampUtc || parseCdrFilenameUtc(filename) || '';
      const timestampMs   = timestampUtc ? Date.parse(timestampUtc) : Number.NaN;

      this.lastProcessedFilename     = filename;
      this.lastProcessedTimestampUtc = timestampUtc;
      this.lastProcessedTimestampMs  = Number.isFinite(timestampMs) ? timestampMs : Number.NaN;

      log.info('Checkpoint loaded', { filename, timestampUtc });
    } catch (error) {
      log.error('Error loading CDR processing checkpoint', { error: error.message });
    }
  }

  // ── Checkpoint helpers ──────────────────────────────────────────────────────

  shouldSkipByCheckpoint(filename, parsedIso) {
    const parsedMs = parsedIso ? Date.parse(parsedIso) : Number.NaN;
    if (!Number.isFinite(this.lastProcessedTimestampMs) || !Number.isFinite(parsedMs)) return false;
    if (parsedMs < this.lastProcessedTimestampMs) return true;
    return (
      parsedMs === this.lastProcessedTimestampMs &&
      !!this.lastProcessedFilename &&
      filename <= this.lastProcessedFilename
    );
  }

  async advanceCheckpointIfNewer(nextMeta) {
    if (!nextMeta || !Number.isFinite(nextMeta.timestampMs)) return;

    const isNewer =
      !Number.isFinite(this.lastProcessedTimestampMs) ||
      nextMeta.timestampMs > this.lastProcessedTimestampMs ||
      (
        nextMeta.timestampMs === this.lastProcessedTimestampMs &&
        nextMeta.filename > this.lastProcessedFilename
      );

    if (!isNewer) return;

    await updateGlobalSettings({
      lastProcessedCdrFilename:     nextMeta.filename,
      lastProcessedCdrTimestampUtc: nextMeta.timestampUtc,
    }, 'cdr-auto-fetcher');

    this.lastProcessedFilename     = nextMeta.filename;
    this.lastProcessedTimestampUtc = nextMeta.timestampUtc;
    this.lastProcessedTimestampMs  = nextMeta.timestampMs;

    log.info('Checkpoint advanced', { filename: nextMeta.filename, timestampUtc: nextMeta.timestampUtc });
  }

  // ── Scheduler ───────────────────────────────────────────────────────────────

  startScheduler() {
    cron.schedule(this.config.fetchInterval, () => {
      this.fetchAndProcessCDRs();
    });

    // Run immediately on startup after a short delay
    setTimeout(() => this.fetchAndProcessCDRs(), 5000);

    log.info('Scheduler started', { interval: this.config.fetchInterval });
  }

  // ── SSH helpers ─────────────────────────────────────────────────────────────

  buildSSHCommand(remoteCommand) {
    const sshBase = (this.config.sshKeyPath && fs.existsSync(this.config.sshKeyPath))
      ? `ssh -i "${this.config.sshKeyPath}" -p ${this.config.sshPort} -o BatchMode=yes -o StrictHostKeyChecking=no`
      : `ssh -p ${this.config.sshPort} -o BatchMode=yes -o StrictHostKeyChecking=no`;

    return `${sshBase} ${this.config.username}@${this.config.serverIP} "${remoteCommand}"`;
  }

  /**
   * Retry wrapper with linear back-off.
   * Retries up to this.config.maxRetries times.
   */
  async fetchWithRetry(fn, context = '') {
    let lastError;
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;
        if (attempt < this.config.maxRetries) {
          const delayMs = attempt * 2000; // 2s, 4s, 6s
          log.warn(`Attempt ${attempt} failed, retrying`, { context, delayMs, error: err.message });
          await new Promise((r) => setTimeout(r, delayMs));
        }
      }
    }
    throw lastError;
  }

  // ── Core fetch loop ─────────────────────────────────────────────────────────

  async fetchAndProcessCDRs() {
    if (this.isRunning) {
      log.warn('Fetch already in progress, skipping this run');
      return;
    }

    this.isRunning = true;
    let latestProcessedMeta = null;
    const seenInRun         = new Set();

    try {
      // Refresh checkpoint in case settings changed outside this process
      await this.loadProcessingCheckpoint();

      const files = await this.listRecentFiles();

      if (files.length === 0) {
        await this.notifyMissingFiles();
        return;
      }

      log.info('Files found for processing', { count: files.length });

      for (const remoteFile of files) {
        const filename = path.basename(remoteFile);

        // Skip duplicate within same run
        if (seenInRun.has(filename)) continue;
        seenInRun.add(filename);

        // Validate filename to prevent shell injection
        if (!SAFE_FILENAME_RE.test(filename)) {
          log.warn('Unsafe filename rejected', { filename });
          continue;
        }

        const parsedIso = parseCdrFilenameUtc(filename);

        // Skip already-processed files via checkpoint
        if (this.shouldSkipByCheckpoint(filename, parsedIso)) {
          log.info('Skipping already-processed file', { filename });
          continue;
        }

        try {
          const csvContent = await this.fetchWithRetry(
            () => this.fetchRemoteFileContent(remoteFile),
            filename,
          );

          const processed = await this.processFile(filename, csvContent);

          if (processed.success) {
            await this.saveToDatabase(processed.cdrs, filename);

            if (parsedIso) {
              const parsedMs = Date.parse(parsedIso);
              if (
                !latestProcessedMeta ||
                parsedMs > latestProcessedMeta.timestampMs ||
                (parsedMs === latestProcessedMeta.timestampMs && filename > latestProcessedMeta.filename)
              ) {
                latestProcessedMeta = { filename, timestampUtc: parsedIso, timestampMs: parsedMs };
              }
            }
          } else {
            await this.notifyFileProcessingFailure(filename, processed.error || 'Unknown processing error');
          }
        } catch (fileError) {
          log.error('Error processing file', { filename, error: fileError.message });
          await this.notifyFileProcessingFailure(filename, fileError.message);
        }

        // Small delay between files to avoid hammering the SSH server
        await new Promise((r) => setTimeout(r, 500));
      }

      if (latestProcessedMeta) {
        await this.advanceCheckpointIfNewer(latestProcessedMeta).catch((err) => {
          log.error('Error advancing checkpoint', { error: err.message });
        });
      }

    } catch (error) {
      log.error('Fatal error in CDR auto-fetch', { error: error.message });
    } finally {
      this.isRunning = false;
    }
  }

  // ── File operations ─────────────────────────────────────────────────────────

  async listRecentFiles() {
    try {
      // Use -mmin -20 (5-min overlap) to guard against delayed cron runs.
      // Checkpoint deduplication prevents double-processing.
      const listCommand = this.buildSSHCommand(
        `find ${this.config.serverPath} -name '${this.config.filePattern}' -type f -mmin -20 2>/dev/null`,
      );

      const { stdout } = await execPromise(listCommand, { timeout: 30000 });

      const files = stdout
        .trim()
        .split('\n')
        .filter((f) => f.length > 0 && path.extname(f) === '.csv')
        .sort((a, b) => a.localeCompare(b));

      log.info('Remote file listing complete', { found: files.length });
      return files;
    } catch (error) {
      log.error('Error listing remote files', { error: error.message });
      return [];
    }
  }

  async fetchRemoteFileContent(remoteFile) {
    const filename = path.basename(remoteFile);

    // Double-check filename safety before constructing shell command
    if (!SAFE_FILENAME_RE.test(filename)) {
      throw new Error(`Unsafe filename rejected: ${filename}`);
    }

    // Safe to use in shell since filename is validated above
    const safeRemotePath = `${this.config.serverPath}/${filename}`;
    const readCommand    = this.buildSSHCommand(`cat '${safeRemotePath}'`);

    const { stdout } = await execPromise(readCommand, {
      timeout:   60000,
      maxBuffer: this.config.maxBufferBytes,
    });

    return stdout;
  }

  async processFile(filename, csvContent) {
    try {
      const parsed = Papa.parse(csvContent, {
        header:         false,
        skipEmptyLines: true,
        transform:      (value) => value.trim(),
      });

      if (parsed.errors.length > 0) {
        log.warn('CSV parsing warnings', { filename, warnings: parsed.errors.length });
      }

      const validCdrs   = [];
      const invalidRows = [];

      parsed.data.forEach((row, index) => {
        const cdr = {};
        CDR_COLUMNS.forEach((col, i) => { cdr[col] = row[i]; });

        if (cdr.callere164 && cdr.starttime) {
          validCdrs.push({ ...cdr, source_file: filename });
        } else {
          invalidRows.push(index);
        }
      });

      if (invalidRows.length > 0) {
        log.warn('Skipped invalid rows', { filename, skipped: invalidRows.length, total: parsed.data.length });
      }

      log.info('File parsed', { filename, valid: validCdrs.length, invalid: invalidRows.length });
      return { success: true, cdrs: validCdrs };
    } catch (error) {
      log.error('File parse error', { filename, error: error.message });
      return { success: false, error: error.message, cdrs: [] };
    }
  }

  async saveToDatabase(cdrs, filename) {
    if (cdrs.length === 0) return;

    const chunkSize  = 100;
    let   savedCount = 0;

    for (let i = 0; i < cdrs.length; i += chunkSize) {
      const chunk = cdrs.slice(i, i + chunkSize);
      try {
        await CDR.bulkCreate(chunk, { ignoreDuplicates: true });
        savedCount += chunk.length;
      } catch (err) {
        log.error('Chunk insert failed', {
          filename,
          chunkStart: i,
          chunkSize:  chunk.length,
          error:      err.message,
        });
        // Continue remaining chunks instead of aborting the whole file
      }
    }

    log.info('Database save complete', { filename, total: cdrs.length, saved: savedCount });
  }

  // ── Notifications ───────────────────────────────────────────────────────────

  async notifyMissingFiles() {
    try {
      const now = Date.now();
      if ((now - this.lastMissingFilesNotificationAt) < this.config.missingFilesNotifyCooldownMs) {
        log.info('Missing-files notification suppressed by cooldown');
        return;
      }

      this.lastMissingFilesNotificationAt = now;

      await createNotification({
        title:        'CDR auto-fetch: no files found',
        message:      `No CDR files matching ${this.config.filePattern} were found in the last fetch window.`,
        type:         'warning',
        category:     'system',
        audienceRole: 'admin',
        metadata: {
          source:        'cdr-auto-fetcher',
          serverPath:    this.config.serverPath,
          fetchInterval: this.config.fetchInterval,
          checkedAtUtc:  new Date(now).toISOString(),
        },
      });
    } catch (error) {
      log.error('Error creating missing-files notification', { error: error.message });
    }
  }

  async notifyFileProcessingFailure(filename, reason) {
    try {
      await createNotification({
        title:        'CDR auto-fetch: file processing failed',
        message:      `Failed to process CDR file ${filename}. Reason: ${reason}`,
        type:         'error',
        category:     'system',
        audienceRole: 'admin',
        metadata: {
          source:      'cdr-auto-fetcher',
          filename,
          reason,
          failedAtUtc: new Date().toISOString(),
        },
      });
    } catch (error) {
      log.error('Error creating file-processing-failed notification', { error: error.message });
    }
  }
}

module.exports = CDRAutoFetcher;