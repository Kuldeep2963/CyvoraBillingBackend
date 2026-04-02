'use strict';

const cron = require('node-cron');
const { Op } = require('sequelize');
const CDR = require('../models/CDR');
const { getGlobalSettings } = require('./system-settings');
const { createNotification } = require('./notification-service');

// ─── Constants ────────────────────────────────────────────────────────────────

const STARTUP_CLEANUP_DELAY_MS = 15_000;       // 15 s — let the app fully boot first
const MIN_CLEANUP_GAP_MS       = 5 * 60_000;   // 5 min — debounce guard for manual triggers
const MIN_RETENTION_DAYS       = 1;            // safety floor: never delete less than 1 day old
const MAX_RETENTION_DAYS       = 60;        // safety ceiling: 10 years

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Compute the UTC cutoff Date for the given retention window.
 *
 * WHY: new Date() reflects server local time, but Sequelize stores createdAt
 * in UTC.  Using UTC arithmetic guarantees the cutoff matches the DB values
 * regardless of the server's TZ environment variable.
 *
 * @param {number} retentionDays
 * @returns {Date} UTC midnight-aligned cutoff
 */
function buildUtcCutoff(retentionDays) {
  const now = new Date();
  // Work entirely in UTC milliseconds — no local-time arithmetic.
  const cutoffMs = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - retentionDays,
    0, 0, 0, 0,   // midnight UTC — inclusive start of the cutoff day
  );
  return new Date(cutoffMs);
}

/**
 * Validate and coerce the retention-days setting.
 * Throws a descriptive Error if the value is unusable so the caller can bail
 * out before touching the database.
 *
 * @param {unknown} raw
 * @returns {number}
 */
function parseRetentionDays(raw) {
  const value = Number(raw);

  if (!Number.isFinite(value)) {
    throw new Error(
      `Invalid dataRetentionDays setting: "${raw}" is not a finite number. ` +
      'Check your global settings configuration.',
    );
  }

  if (!Number.isInteger(value)) {
    throw new Error(
      `Invalid dataRetentionDays setting: "${raw}" must be a whole number of days.`,
    );
  }

  if (value < MIN_RETENTION_DAYS) {
    throw new Error(
      `dataRetentionDays (${value}) is below the minimum allowed value of ${MIN_RETENTION_DAYS}. ` +
      'Refusing to run to prevent accidental data deletion.',
    );
  }

  if (value > MAX_RETENTION_DAYS) {
    throw new Error(
      `dataRetentionDays (${value}) exceeds the maximum allowed value of ${MAX_RETENTION_DAYS}. ` +
      'Check your global settings configuration.',
    );
  }

  return value;
}

// ─── Service ──────────────────────────────────────────────────────────────────

class CDRRetentionService {
  constructor() {
    this.started    = false;
    this.running    = false;
    this.lastRunAt  = 0;
    this._cronTask  = null;   // keep a reference so we can stop it if needed
  }

  /**
   * Register the daily cron job and schedule a one-off startup cleanup.
   * Safe to call multiple times — subsequent calls are no-ops.
   */
  start() {
    if (this.started || globalThis.__cdrRetentionSchedulerStarted) return;

    this.started = true;
    globalThis.__cdrRetentionSchedulerStarted = true;

    // BUG FIX: attach .catch() so errors from the cron invocation are never
    // swallowed silently and always surface in the process error log.
    this._cronTask = cron.schedule('10 1 * * *', () => {
      this.runCleanup({ trigger: 'cron' }).catch((err) => {
        console.error('[CDRRetention] Unhandled error in cron cleanup:', err);
      });
    });

    setTimeout(() => {
      this.runCleanup({ trigger: 'startup' }).catch((err) => {
        console.error('[CDRRetention] Unhandled error in startup cleanup:', err);
      });
    }, STARTUP_CLEANUP_DELAY_MS);

    console.log('[CDRRetention] Scheduler initialised — daily at 01:10 server time.');
  }

  /**
   * Stop the cron job and mark the service as not started.
   * Useful for graceful shutdown and for test teardown.
   */
  stop() {
    if (this._cronTask) {
      this._cronTask.stop();
      this._cronTask = null;
    }
    this.started = false;
    globalThis.__cdrRetentionSchedulerStarted = false;
    console.log('[CDRRetention] Scheduler stopped.');
  }

  /**
   * Execute the CDR retention cleanup.
   *
   * @param {object}  opts
   * @param {string}  [opts.trigger='manual']  Label for logs ('cron' | 'startup' | 'manual')
   * @param {boolean} [opts.force=false]        Skip the min-gap guard
   * @returns {Promise<CleanupResult>}
   *
   * @typedef {{ skipped: true,  reason: string,    trigger: string }}              SkippedResult
   * @typedef {{ skipped: false, deletedCount: number, retentionDays: number,
   *             cutoff: string, trigger: string, durationMs: number }}             CleanupResult
   */
  async runCleanup({ trigger = 'manual', force = false } = {}) {
    const now = Date.now();

    // ── Guard: concurrent run ──────────────────────────────────────────────
    if (this.running) {
      console.warn(
        `[CDRRetention] Skipped ${trigger} cleanup — previous run still in progress.`,
      );
      return { skipped: true, reason: 'already-running', trigger };
    }

    // ── Guard: minimum gap between runs ───────────────────────────────────
    if (!force && this.lastRunAt && (now - this.lastRunAt) < MIN_CLEANUP_GAP_MS) {
      const waitSec = Math.ceil((MIN_CLEANUP_GAP_MS - (now - this.lastRunAt)) / 1000);
      console.warn(
        `[CDRRetention] Skipped ${trigger} cleanup — minimum gap not reached ` +
        `(${waitSec}s remaining).`,
      );
      return { skipped: true, reason: 'min-gap', trigger };
    }

    this.running   = true;
    this.lastRunAt = now;
    const startedAt = Date.now();

    try {
      console.log(`[CDRRetention] Starting cleanup (trigger: ${trigger})`);

      // ── Load & validate settings ─────────────────────────────────────────
      const settings = await getGlobalSettings();

      // BUG FIX: parseRetentionDays throws a descriptive error on NaN/invalid
      // values, preventing the catastrophic "delete everything" failure that
      // Number(undefined) → NaN → setDate(NaN) → Invalid Date would cause.
      const retentionDays = parseRetentionDays(settings?.dataRetentionDays);

      // BUG FIX: build cutoff in pure UTC arithmetic so the result is
      // independent of the server's local timezone (TZ env var).
      // Sequelize stores createdAt in UTC; using local-time Date arithmetic
      // on a server in e.g. UTC+5:30 would shift the cutoff by 5h30m and
      // potentially delete records that are not yet eligible.
      const cutoff = buildUtcCutoff(retentionDays);

      console.log(
        `[CDRRetention] Retention policy: ${retentionDays} days | ` +
        `Cutoff (UTC): ${cutoff.toISOString()}`,
      );

      // ── Delete ───────────────────────────────────────────────────────────
      const deletedCount = await CDR.destroy({
        where: {
          createdAt: { [Op.lt]: cutoff },
        },
      });

      const durationMs = Date.now() - startedAt;

      // BUG FIX: log completion regardless of deletedCount so operators can
      // confirm the job ran, even on quiet nights with nothing to delete.
      console.log(
        `[CDRRetention] Cleanup complete — deleted ${deletedCount} record(s) ` +
        `in ${durationMs}ms (trigger: ${trigger}).`,
      );

      // Only send a notification when there is actually something to report.
      if (deletedCount > 0) {
        await createNotification({
          title:    'CDR retention cleanup complete',
          message:  `${deletedCount} old CDR record(s) deleted — ` +
                    `${retentionDays}-day retention policy applied.`,
          type:     'warning',
          category: 'retention',
          metadata: {
            deletedCount,
            retentionDays,
            cutoff:     cutoff.toISOString(),
            trigger,
            durationMs,
          },
        }).catch((notifyErr) => {
          // Non-fatal: log but do not throw — the cleanup itself succeeded.
          console.error('[CDRRetention] Failed to create notification:', notifyErr);
        });
      }

      return {
        skipped:      false,
        deletedCount,
        retentionDays,
        cutoff:       cutoff.toISOString(),
        trigger,
        durationMs,
      };

    } catch (err) {
      // Re-throw so the cron .catch() / caller sees the failure,
      // but always emit a structured log entry first.
      console.error(
        `[CDRRetention] Cleanup failed (trigger: ${trigger}):`,
        err.message,
      );
      throw err;

    } finally {
      this.running = false;
    }
  }
}

// ─── Singleton export ─────────────────────────────────────────────────────────

module.exports = CDRRetentionService;