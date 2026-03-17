const cron = require('node-cron');
const { Op } = require('sequelize');
const Notification = require('../models/Notification');

class NotificationRetentionService {
  constructor() {
    this.started = false;
    this.retentionDays = 7;
  }

  start() {
    if (this.started) return;
    this.started = true;

    // Runs every day at 01:20 server time.
    cron.schedule('20 1 * * *', async () => {
      await this.runCleanup();
    });

    // Run once shortly after startup.
    setTimeout(() => {
      this.runCleanup().catch((error) => {
        console.error('Initial notification retention cleanup failed:', error.message);
      });
    }, 20000);

  }

  async runCleanup() {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.retentionDays);

    const deletedCount = await Notification.destroy({
      where: {
        createdAt: {
          [Op.lt]: cutoff,
        },
      },
    });

    if (deletedCount > 0) {
      console.log(`Notification retention cleanup: deleted ${deletedCount} records older than ${this.retentionDays} days`);
    }

    return {
      deletedCount,
      retentionDays: this.retentionDays,
      cutoff: cutoff.toISOString(),
    };
  }
}

module.exports = NotificationRetentionService;
