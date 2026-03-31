const cron = require('node-cron');
const { Op } = require('sequelize');
const CDR = require('../models/CDR');
const { getGlobalSettings } = require('./system-settings');
const { createNotification } = require('./notification-service');

const STARTUP_CLEANUP_DELAY_MS = 15000;
const MIN_CLEANUP_GAP_MS = 5 * 60 * 1000;

class CDRRetentionService {
  constructor() {
    this.started = false;
    this.running = false;
    this.lastRunAt = 0;
  }

  start() {
    if (this.started || globalThis.__cdrRetentionSchedulerStarted) return;
    this.started = true;
    globalThis.__cdrRetentionSchedulerStarted = true;

    // Runs every day at 01:10 server time.
    cron.schedule('10 1 * * *', async () => {
      await this.runCleanup({ trigger: 'cron' });
    });

    setTimeout(() => {
      this.runCleanup({ trigger: 'startup' }).catch((error) => {
        console.error('Initial CDR retention cleanup failed:', error.message);
      });
    }, STARTUP_CLEANUP_DELAY_MS);

    console.log('CDR Retention Scheduler initialized: Daily at 01:10');
  }

  async runCleanup({ trigger = 'manual', force = false } = {}) {
    const now = Date.now();

    if (this.running) {
      console.log(`[CDRRetention] Skipped ${trigger} cleanup: previous run still in progress.`);
      return { skipped: true, reason: 'already-running', trigger };
    }

    if (!force && this.lastRunAt && (now - this.lastRunAt) < MIN_CLEANUP_GAP_MS) {
      console.log(`[CDRRetention] Skipped ${trigger} cleanup: minimum run gap not reached.`);
      return { skipped: true, reason: 'min-gap', trigger };
    }

    this.running = true;
    this.lastRunAt = now;

    try {
      console.log(`[CDRRetention] Starting cleanup (trigger: ${trigger})`);

    const settings = await getGlobalSettings();
    const retentionDays = Number(settings.dataRetentionDays);

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    const deletedCount = await CDR.destroy({
      where: {
        createdAt: {
          [Op.lt]: cutoff,
        },
      },
    });

    if (deletedCount > 0) {
      await createNotification({
        title: 'CDR retention cleanup complete',
        message: `${deletedCount} old CDR records were deleted based on ${retentionDays} day retention policy.`,
        type: 'warning',
        category: 'retention',
        metadata: { deletedCount, retentionDays, cutoff: cutoff.toISOString() },
      });
    }

      return {
        deletedCount,
        retentionDays,
        cutoff: cutoff.toISOString(),
        trigger,
      };
    } finally {
      this.running = false;
    }
  }
}

module.exports = CDRRetentionService;
