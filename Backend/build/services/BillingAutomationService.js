
const { Op } = require('sequelize');
const Account = require('../models/Account');
const InvoiceService = require('./InvoiceService');
const EmailService = require('./EmailService');
const moment = require('moment');

class BillingAutomationService {
  /**
   * Calculate next billing date based on cycle
   */
  calculateNextBillingDate(currentDate, cycle) {
    const date = moment(currentDate);
    switch (cycle) {
      case 'daily':
        return date.add(1, 'days').format('YYYY-MM-DD');
      case 'weekly':
        return date.add(1, 'weeks').format('YYYY-MM-DD');
      case 'monthly':
        return date.add(1, 'months').format('YYYY-MM-DD');
      case 'quarterly':
        return date.add(3, 'months').format('YYYY-MM-DD');
      case 'annually':
        return date.add(1, 'years').format('YYYY-MM-DD');
      default:
        return date.add(1, 'months').format('YYYY-MM-DD');
    }
  }

  /**
   * Initialize billing dates for accounts where they are missing
   */
  async initializeMissingDates() {
    const accounts = await Account.findAll({
      where: {
        [Op.or]: [
          { nextbillingdate: null },
          
        ]
      }
    });

    for (const account of accounts) {
      const startDate = account.billingStartDate || account.createdAt || new Date();
      const nextDate = this.calculateNextBillingDate(startDate, account.billingCycle);
      await account.update({
        nextbillingdate: nextDate
      });
    }
  }

  /**
   * Run automation for all due accounts
   */
  async runAutomation() {
    // First, ensure all accounts have a nextbillingdate
    await this.initializeMissingDates();

    const today = moment().format('YYYY-MM-DD');
    const accounts = await Account.findAll({
      where: {
        active: true,
        nextbillingdate: {
          [Op.lte]: today
        }
      }
    });

    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
      details: []
    };

    for (const account of accounts) {
      results.processed++;
      try {
        const billingPeriodStart = account.lastbillingdate || account.billingStartDate || account.createdAt;
        // Bill up to the day before nextbillingdate
        const billingPeriodEnd = moment(account.nextbillingdate).subtract(1, 'days').format('YYYY-MM-DD');

        let customerInvoice = null;
        let vendorInvoice = null;

        // Customer Invoice
        if (['customer', 'both'].includes(account.accountRole)) {
          try {
            customerInvoice = await InvoiceService.generateInvoiceFromCDRs({
              customerId: account.gatewayId || account.customerCode,
              invoiceType: 'customer',
              billingPeriodStart,
              billingPeriodEnd,
              generatedBy: 'SYSTEM'
            });

            // Send notification if enabled
            if (customerInvoice && account.sendInvoiceEmail) {
              EmailService.sendInvoiceEmail(customerInvoice, account).catch(err => {
                console.error(`Failed to send automated customer invoice email for ${account.accountName}:`, err);
              });
            }
          } catch (e) {
            // Only catch "No CDR" errors, let other errors bubble up to skip updating dates
            if (e.message.includes('No CDR records found') || e.message.includes('No successful calls found')) {
              console.log(`No customer CDRs for ${account.accountName} from ${billingPeriodStart} to ${billingPeriodEnd}`);
            } else {
              throw e;
            }
          }
        }

        // Vendor Invoice
        if (['vendor', 'both'].includes(account.accountRole)) {
          try {
            vendorInvoice = await InvoiceService.generateInvoiceFromCDRs({
              customerId: account.gatewayId || account.vendorCode,
              invoiceType: 'vendor',
              billingPeriodStart,
              billingPeriodEnd,
              generatedBy: 'SYSTEM'
            });

            // Send notification if enabled
            if (vendorInvoice && account.sendInvoiceEmail) {
              EmailService.sendInvoiceEmail(vendorInvoice, account).catch(err => {
                console.error(`Failed to send automated vendor invoice email for ${account.accountName}:`, err);
              });
            }
          } catch (e) {
            // Only catch "No CDR" errors, let other errors bubble up to skip updating dates
            if (e.message.includes('No CDR records found') || e.message.includes('No successful calls found')) {
              console.log(`No vendor CDRs for ${account.accountName} from ${billingPeriodStart} to ${billingPeriodEnd}`);
            } else {
              throw e;
            }
          }
        }

        if (!customerInvoice && !vendorInvoice) {
          results.skipped++;
          // Still update dates even if no invoice was generated (to avoid infinite loop of trying)
          // Or should we? If no CDRs found, maybe we should just move to next cycle.
        }

        // Update billing dates
        const newLastBillingDate = account.nextbillingdate;
        const newNextBillingDate = this.calculateNextBillingDate(account.nextbillingdate, account.billingCycle);

        await account.update({
          lastbillingdate: newLastBillingDate,
          nextbillingdate: newNextBillingDate
        });

        results.succeeded++;
        results.details.push({
          accountId: account.accountId,
          accountName: account.accountName,
          status: 'success',
          customerInvoice: customerInvoice?.invoiceNumber || null,
          vendorInvoice: vendorInvoice?.invoiceNumber || null
        });

      } catch (error) {
        results.failed++;
        results.details.push({
          accountId: account.accountId,
          accountName: account.accountName,
          status: 'failed',
          error: error.message
        });
        console.error(`Automation failed for account ${account.accountId}:`, error);
      }
    }

    return results;
  }
}

module.exports = new BillingAutomationService();
