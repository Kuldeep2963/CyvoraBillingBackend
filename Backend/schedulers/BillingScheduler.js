
const cron = require('node-cron');
const billingConfig = require('../config/Billingconfig');
const BillingAutomationService = require('../services/BillingAutomationService');
const InvoiceService = require('../services/InvoiceService');

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

    if (billingConfig.scheduler?.overdueCheckEnabled) {
      cron.schedule(billingConfig.scheduler.overdueCheckSchedule || '0 1 * * *', async () => {
        console.log('--- Starting Overdue Invoice Status Sync ---');
        try {
          const results = await InvoiceService.syncOverdueInvoiceStatuses();
          console.log('--- Overdue Invoice Status Sync Completed ---');
          console.log(`Checked: ${results.checked}, Updated: ${results.updated}`);
        } catch (error) {
          console.error('--- Overdue Invoice Status Sync Failed ---');
          console.error(error);
        }
      });

      console.log(`Billing overdue status sync initialized: ${billingConfig.scheduler.overdueCheckSchedule || '0 1 * * *'}`);
    }

    console.log('Billing Scheduler initialized: Daily at 00:00');
  }
}

module.exports = BillingScheduler;
