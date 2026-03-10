
const cron = require('node-cron');
const BillingAutomationService = require('../services/BillingAutomationService');

class BillingScheduler {
  constructor() {
    this.init();
  }

  init() {
    // Run every day at midnight (00:00)
    cron.schedule('0 0 * * *', async () => {
      console.log('--- Starting Daily Billing Automation ---');
      try {
        const results = await BillingAutomationService.runAutomation();
        console.log('--- Daily Billing Automation Completed ---');
        console.log(`Processed: ${results.processed}, Succeeded: ${results.succeeded}, Failed: ${results.failed}`);
      } catch (error) {
        console.error('--- Daily Billing Automation Failed ---');
        console.error(error);
      }
    });

    console.log('Billing Scheduler initialized: Daily at 00:00');
  }
}

module.exports = BillingScheduler;
