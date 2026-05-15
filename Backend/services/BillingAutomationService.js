
const { Op } = require('sequelize');
const Account = require('../models/Account');
const InvoiceService = require('./InvoiceService');
const moment = require('moment');
const {
  buildBillingUpdates,
  calculateNextBillingDate,
  getInitialLastBillingDate,
  getBillingPeriodWindow,
  normalizeDateOnly,
} = require('../utils/CalendarBillingCalculator');

class BillingAutomationService {
  /**
   * Calculate next billing date based on cycle
   */
  calculateNextBillingDate(currentDate, cycle) {
    return calculateNextBillingDate(currentDate, cycle);
  }

  getStreamConfig(invoiceType) {
    return invoiceType === 'vendor'
      ? {
          lastField: 'vendorLastBillingDate',
          nextField: 'vendorNextBillingDate',
        }
      : {
          lastField: 'customerLastBillingDate',
          nextField: 'customerNextBillingDate',
        };
  }

  resolveStreamWindow(account, invoiceType) {
    const { lastField, nextField } = this.getStreamConfig(invoiceType);
    const lastBillingDate = account[lastField]
      || getInitialLastBillingDate(account.billingCycle || 'monthly', account.billingStartDate || account.createdAt || new Date());
    
    // Normalize dates to 'YYYY-MM-DD' format to ensure consistency across different DB types
    const normalizedLastBillingDate = lastBillingDate 
      ? normalizeDateOnly(lastBillingDate)
      : null;
    
    const rawNextBillingDate = account[nextField]
      || (normalizedLastBillingDate ? this.calculateNextBillingDate(normalizedLastBillingDate, account.billingCycle) : null);
    
    // Normalize next billing date to 'YYYY-MM-DD' format
    const normalizedNextBillingDate = rawNextBillingDate
      ? normalizeDateOnly(rawNextBillingDate)
      : null;

    return { lastBillingDate: normalizedLastBillingDate, nextBillingDate: normalizedNextBillingDate };
  }

  buildStreamUpdates(account, invoiceType, invoicePeriodEnd) {
    return buildBillingUpdates(account, invoiceType, invoicePeriodEnd);
  }

  /**
   * Initialize billing dates for accounts where they are missing
   * Initializes both customer and vendor dates to support independent advancement.
   * Note: Automation only uses customerNextBillingDate; vendor dates are managed
   * separately on the vendor invoice page.
   */
  async initializeMissingDates() {
    // Backfill directional dates so each billing stream can advance independently.
    const accounts = await Account.findAll({
      where: {
        [Op.or]: [
          { customerNextBillingDate: null },
          { vendorNextBillingDate: null },
        ]
      }
    });

    for (const account of accounts) {
      const startDate = account.billingStartDate || account.createdAt || new Date();
      const role = String(account.accountRole || '').toLowerCase();
      const updates = {};

      if (!account.customerLastBillingDate) {
        updates.customerLastBillingDate = getInitialLastBillingDate(account.billingCycle || 'monthly', startDate);
      }
      if (!account.customerNextBillingDate) {
        updates.customerNextBillingDate = this.calculateNextBillingDate(
          account.customerLastBillingDate || updates.customerLastBillingDate,
          account.billingCycle
        );
      }

      if (role === 'vendor' || role === 'both') {
        if (!account.vendorLastBillingDate) {
          updates.vendorLastBillingDate = getInitialLastBillingDate(account.billingCycle || 'monthly', startDate);
        }
        if (!account.vendorNextBillingDate) {
          updates.vendorNextBillingDate = this.calculateNextBillingDate(
            account.vendorLastBillingDate || updates.vendorLastBillingDate,
            account.billingCycle
          );
        }
      }

      if (Object.keys(updates).length > 0) {
        await account.update(updates);
      }
    }
  }

  /**
   * Run automation for all due accounts (customer invoices only)
   * Vendor invoices are uploaded manually on the vendor invoice page.
   * Only customerNextBillingDate is used for automation scheduling.
   *
   * Catch-up behavior: if multiple billing cycles are overdue, this method
   * processes them sequentially in a single run.
   */
  async runAutomation() {
    // First, ensure all accounts have a nextbillingdate
    await this.initializeMissingDates();

    const today = moment().format('YYYY-MM-DD');
    const accounts = await Account.findAll({
      where: {
        active: true,
        // Only check customer billing dates for automation
        customerNextBillingDate: { [Op.lte]: today }
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
        let customerInvoice = null;
        let accountChanged = false;
        let accountHadFatalError = false;
        const streamResults = [];
        let generatedInvoicesCount = 0;
        let skippedCyclesCount = 0;

        // Only generate customer invoices (vendor invoices are uploaded manually)
        const invoiceType = 'customer';
        let window = this.resolveStreamWindow(account, invoiceType);
        const maxCatchupCycles = 12; // Prevent infinite loops if something goes wrong with billing dates
        let cyclesProcessed = 0;

        if (!window.nextBillingDate || moment(window.nextBillingDate).isAfter(today, 'day')) {
          streamResults.push({ invoiceType, status: 'not_due' });
          skippedCyclesCount++;
          results.details.push({
            accountId: account.accountId,
            accountName: account.accountName,
            status: 'skipped',
            customerInvoice: null,
            streams: streamResults
          });
          results.skipped += skippedCyclesCount;
          continue;
        }
        const customerId = account.gatewayId || account.customerCode;

        while (window.nextBillingDate && !moment(window.nextBillingDate).isAfter(today, 'day')) {
          cyclesProcessed++;
          if (cyclesProcessed > maxCatchupCycles) {
            accountHadFatalError = true;
            streamResults.push({
              invoiceType,
              status: 'failed',
              error: `Maximum catch-up cycles (${maxCatchupCycles}) reached`,
            });
            break;
          }

          const {
            billingPeriodStart,
            billingPeriodEnd,
          } = getBillingPeriodWindow(window.lastBillingDate, account.billingCycle);

          if (!billingPeriodStart || !billingPeriodEnd) {
            accountHadFatalError = true;
            streamResults.push({
              invoiceType,
              status: 'failed',
              error: 'Invalid billing period window',
            });
            break;
          }

          try {
            const invoice = await InvoiceService.generateInvoiceFromCDRs({
              customerId,
              invoiceType,
              billingPeriodStart,
              billingPeriodEnd,
              generatedBy: null
            });

            customerInvoice = invoice;

            // Do not auto-send invoice emails on generation.
            // Invoices are sent explicitly through the UI/API send-email action.
            const updates = this.buildStreamUpdates(account, invoiceType, billingPeriodEnd);
            await account.update(updates);
            accountChanged = true;
            generatedInvoicesCount++;

            streamResults.push({
              invoiceType,
              status: 'success',
              billingPeriodStart,
              billingPeriodEnd,
              invoiceNumber: invoice?.invoiceNumber || null,
            });

            window = {
              lastBillingDate: updates.customerLastBillingDate,
              nextBillingDate: updates.customerNextBillingDate,
            };
          } catch (e) {
            if (e.message.includes('No CDR records found') || e.message.includes('No successful calls found')) {
              console.log(`No customer CDRs for ${account.accountName} from ${billingPeriodStart} to ${billingPeriodEnd}`);

              // Advance cursor even when no CDRs exist for the cycle, so catch-up continues.
              const updates = this.buildStreamUpdates(account, invoiceType, billingPeriodEnd);
              await account.update(updates);
              accountChanged = true;
              skippedCyclesCount++;

              streamResults.push({
                invoiceType,
                status: 'no_cdr',
                billingPeriodStart,
                billingPeriodEnd,
                advanced: true,
              });

              window = {
                lastBillingDate: updates.customerLastBillingDate,
                nextBillingDate: updates.customerNextBillingDate,
              };
            } else {
              accountHadFatalError = true;
              streamResults.push({
                invoiceType,
                status: 'failed',
                billingPeriodStart,
                billingPeriodEnd,
                error: e.message,
              });
              break;
            }
          }
        }

        results.succeeded += generatedInvoicesCount;
        results.skipped += skippedCyclesCount;
        if (accountHadFatalError) {
          results.failed++;
        }

        results.details.push({
          accountId: account.accountId,
          accountName: account.accountName,
          status: accountHadFatalError
            ? (accountChanged ? 'partial_failed' : 'failed')
            : (accountChanged ? 'success' : 'skipped'),
          customerInvoice: customerInvoice?.invoiceNumber || null,
          generatedInvoicesCount,
          skippedCyclesCount,
          streams: streamResults
        });

      } catch (error) {
        results.failed++;
        results.details.push({
          accountId: account.accountId,
          accountName: account.accountName,
          status: 'failed',
          error: error.message,
          streams: []
        });
        console.error(`Automation failed for account ${account.accountId}:`, error);
      }
    }

    return results;
  }
}

module.exports = new BillingAutomationService();
