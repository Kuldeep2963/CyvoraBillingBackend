const sequelize = require('../config/database');
const Account = require('../models/Account');
const Invoice = require('../models/Invoice');
const InvoiceItem = require('../models/InvoiceItem');
const InvoiceService = require('../services/InvoiceService');
const BillingAutomationService = require('../services/BillingAutomationService');
const { getBillingPeriodWindow, addDays } = require('../utils/CalendarBillingCalculator');
const billingController = require('../controllers/Billingcontroller');

const mockRes = () => {
  const res = {};
  res.status = (code) => ({ json: (body) => { console.log('RES STATUS', code, body); return body; } });
  res.json = (body) => { console.log('RES JSON', body); return body; };
  return res;
};

(async () => {
  try {
    await sequelize.authenticate();
    const account = await Account.findOne({ where: { active: true } });
    if (!account) { console.log('No active account found'); process.exit(0); }

    console.log('Account before:', account.accountId, account.customerLastBillingDate, account.customerNextBillingDate);

    const svc = require('../services/BillingAutomationService');
    const window = svc.resolveStreamWindow(account, 'customer');
    const { billingPeriodStart, billingPeriodEnd } = getBillingPeriodWindow(window.lastBillingDate, account.billingCycle);

    console.log('Using period', billingPeriodStart, billingPeriodEnd);

    const invoiceNumber = await InvoiceService.generateInvoiceNumber();
    const invoiceDate = Date.now();
    const dueDate = Date.now() + 7 * 24 * 60 * 60 * 1000;

    const toUtcMidnight = (d) => {
      const [y,m,day] = d.split('-').map(Number);
      return Date.UTC(y, m - 1, day);
    };
    const toUtcEndOfDay = (d) => {
      const [y,m,day] = d.split('-').map(Number);
      return Date.UTC(y, m - 1, day, 23, 59, 59, 999);
    };

    const invoice = await Invoice.create({
      invoiceNumber,
      customerGatewayId: account.customerCode || account.gatewayId || account.accountId,
      customerName: account.accountName,
      customerCode: account.customerCode,
      customerEmail: account.email,
      customerAddress: account.addressLine1 || '',
      customerPhone: account.phone || '',
      billingPeriodStart: billingPeriodStart ? toUtcMidnight(billingPeriodStart) : Date.now(),
      billingPeriodEnd: billingPeriodEnd ? toUtcEndOfDay(billingPeriodEnd) : Date.now(),
      invoiceDate,
      dueDate,
      subtotal: 1.00,
      taxRate: 0,
      taxAmount: 0,
      discountAmount: 0,
      totalAmount: 1.00,
      balanceAmount: 1.00,
      totalCalls: 1,
      status: 'draft',
    });

    await InvoiceItem.create({
      invoiceId: invoice.id,
      itemType: 'call_charges',
      description: 'Test item',
      quantity: 1,
      duration: 1,
      unitPrice: 1.00,
      amount: 1.00,
      periodStart: billingPeriodStart ? Date.UTC(...billingPeriodStart.split('-').map((s,i)=> i===0?Number(s):Number(s)- (i===1?1:0))) : Date.now(),
      periodEnd: billingPeriodEnd ? toUtcEndOfDay(billingPeriodEnd) : Date.now(),
      sortOrder: 0,
    });

    console.log('Invoice created id:', invoice.id);

    // Manually apply billing cursor update similar to generateInvoice flow
    const periodEndDateStr = billingPeriodEnd;
    const updates = BillingAutomationService.buildStreamUpdates(account, 'customer', periodEndDateStr);
    await account.update(updates);
    await account.reload();
    console.log('Account after invoice creation:', account.customerLastBillingDate, account.customerNextBillingDate);

    // Now delete using controller handler (it will call internal delete logic)
    const req = { params: { id: String(invoice.id) } };
    const res = mockRes();
    await billingController.deleteInvoice(req, res);

    await account.reload();
    console.log('Account after deletion:', account.customerLastBillingDate, account.customerNextBillingDate);

    process.exit(0);
  } catch (err) {
    console.error('E2E test failed:', err);
    process.exit(1);
  }
})();
