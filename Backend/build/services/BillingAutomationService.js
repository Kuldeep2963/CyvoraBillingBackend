
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
    const legacyLast = account.lastbillingdate || account.billingStartDate || account.createdAt;
    const lastBillingDate = account[lastField] || legacyLast;
    const nextBillingDate = account[nextField]
      || account.nextbillingdate
      || (lastBillingDate ? this.calculateNextBillingDate(lastBillingDate, account.billingCycle) : null);

    return { lastBillingDate, nextBillingDate };
  }

  buildStreamUpdates(account, invoiceType, billedThroughDate) {
    const { lastField, nextField } = this.getStreamConfig(invoiceType);
    const nextBillingDate = this.calculateNextBillingDate(billedThroughDate, account.billingCycle);
    const updates = {
      [lastField]: billedThroughDate,
      [nextField]: nextBillingDate,
    };

    if (invoiceType === 'customer' || String(account.accountRole || '').toLowerCase() !== 'both') {
      updates.lastbillingdate = billedThroughDate;
      updates.nextbillingdate = nextBillingDate;
    }

    return updates;
  }

  /**
   * Initialize billing dates for accounts where they are missing
   */
  async initializeMissingDates() {
    // Backfill directional dates so each billing stream can advance independently.
    const accounts = await Account.findAll({
      where: {
        [Op.or]: [
          { nextbillingdate: null },
          { customerNextBillingDate: null },
          { vendorNextBillingDate: null },
        ]
      }
    });

    for (const account of accounts) {
      const startDate = account.billingStartDate || account.createdAt || new Date();
      const legacyLast = account.lastbillingdate || startDate;
      const legacyNext = account.nextbillingdate || this.calculateNextBillingDate(legacyLast, account.billingCycle);
      const role = String(account.accountRole || '').toLowerCase();
      const updates = {};

      if (!account.customerLastBillingDate) {
        updates.customerLastBillingDate = legacyLast;
      }
      if (!account.customerNextBillingDate) {
        updates.customerNextBillingDate = legacyNext;
      }

      if (role === 'vendor' || role === 'both') {
        if (!account.vendorLastBillingDate) {
          updates.vendorLastBillingDate = legacyLast;
        }
        if (!account.vendorNextBillingDate) {
          updates.vendorNextBillingDate = legacyNext;
        }
      }

      if (!account.nextbillingdate) {
        updates.nextbillingdate = legacyNext;
      }

      if (Object.keys(updates).length > 0) {
        await account.update(updates);
      }
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
        [Op.or]: [
          { nextbillingdate: { [Op.lte]: today } },
          { customerNextBillingDate: { [Op.lte]: today } },
          { vendorNextBillingDate: { [Op.lte]: today } },
        ]
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
        const role = String(account.accountRole || '').toLowerCase();
        const eligibleInvoiceTypes = [
          ...(role === 'customer' || role === 'both' ? ['customer'] : []),
          ...(role === 'vendor' || role === 'both' ? ['vendor'] : []),
        ];

        let customerInvoice = null;
        let vendorInvoice = null;
        let accountChanged = false;
        let accountHadFatalError = false;
        const streamResults = [];

        for (const invoiceType of eligibleInvoiceTypes) {
          const { lastBillingDate, nextBillingDate } = this.resolveStreamWindow(account, invoiceType);
          if (!nextBillingDate || moment(nextBillingDate).isAfter(today, 'day')) {
            streamResults.push({ invoiceType, status: 'not_due' });
            continue;
          }

          const billingPeriodStart = lastBillingDate;
          const billingPeriodEnd = moment(nextBillingDate).subtract(1, 'days').format('YYYY-MM-DD');
          const customerId = invoiceType === 'vendor'
            ? account.gatewayId || account.vendorCode
            : account.gatewayId || account.customerCode;

          try {
            const invoice = await InvoiceService.generateInvoiceFromCDRs({
              customerId,
              invoiceType,
              billingPeriodStart,
              billingPeriodEnd,
              generatedBy: 'SYSTEM'
            });

            if (invoiceType === 'customer') {
              customerInvoice = invoice;
            } else {
              vendorInvoice = invoice;
            }

            if (invoice && account.sendInvoiceEmail) {
              EmailService.sendInvoiceEmail(invoice, account).catch(err => {
                console.error(`Failed to send automated ${invoiceType} invoice email for ${account.accountName}:`, err);
              });
            }

            await account.update(this.buildStreamUpdates(account, invoiceType, nextBillingDate));
            accountChanged = true;
            streamResults.push({ invoiceType, status: 'success', invoiceNumber: invoice?.invoiceNumber || null });
          } catch (e) {
            if (e.message.includes('No CDR records found') || e.message.includes('No successful calls found')) {
              console.log(`No ${invoiceType} CDRs for ${account.accountName} from ${billingPeriodStart} to ${billingPeriodEnd}`);
              streamResults.push({ invoiceType, status: 'no_cdr' });
            } else {
              accountHadFatalError = true;
              streamResults.push({ invoiceType, status: 'failed', error: e.message });
            }
          }
        }

        if (!accountChanged) {
          if (accountHadFatalError) {
            results.failed++;
          } else {
            results.skipped++;
          }
        } else {
          results.succeeded++;
          if (accountHadFatalError) {
            results.failed++;
          }
        }

        results.details.push({
          accountId: account.accountId,
          accountName: account.accountName,
          status: accountChanged ? 'success' : 'skipped',
          customerInvoice: customerInvoice?.invoiceNumber || null,
          vendorInvoice: vendorInvoice?.invoiceNumber || null,
          streams: streamResults,
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
