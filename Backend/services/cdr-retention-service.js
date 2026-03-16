const cron = require('node-cron');
const { Op } = require('sequelize');
const CDR = require('../models/CDR');
const { getGlobalSettings } = require('./system-settings');
const { createNotification } = require('./notification-service');

class CDRRetentionService {
  constructor() {
    this.started = false;
  }

  start() {
    if (this.started) return;
    this.started = true;

    // Runs every day at 01:10 server time.
    cron.schedule('10 1 * * *', async () => {
      await this.runCleanup();
    });

    setTimeout(() => {
      this.runCleanup().catch((error) => {
        console.error('Initial CDR retention cleanup failed:', error.message);
      });
    }, 15000);

    console.log('CDR Retention Scheduler initialized: Daily at 01:10');
  }

  async runCleanup() {
    const settings = await getGlobalSettings();
    const retentionDays = Number(settings.dataRetentionDays) || 60;

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
    };
  }
}

module.exports = CDRRetentionService;
