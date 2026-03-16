/**
 * Invoice Service
 * 
 * Business logic layer for invoice operations
 * Separates business logic from controller/routes
 */

const { Op, fn, col } = require('sequelize');
const sequelize = require('../config/database');
const Invoice = require('../models/Invoice');
const InvoiceItem = require('../models/InvoiceItem');
const Account = require('../models/Account');
const CDR = require('../models/CDR');
const CountryCode = require('../models/CountryCode');
const billingConfig = require('../config/Billingconfig');
const H = require('../utils/reportHelper');
const { parsePhoneNumberFromString } = require('libphonenumber-js');

/* ===================== HELPER: FORMAT TIME ===================== */
const formatTime = (date, hour = 0, isEnd = false) => {
  if (!date) return null;
  
  // Handle numeric strings (Unix timestamps)
  const numericDate = Number(date);
  const d = !isNaN(numericDate) ? new Date(numericDate) : new Date(date);
  
  if (isNaN(d.getTime())) return null;
  
  d.setHours(hour, isEnd ? 59 : 0, isEnd ? 59 : 0, isEnd ? 999 : 0);
  return d.getTime().toString();
};

/* ===================== HELPER: GET COUNTRY FROM NUMBER ===================== */
const getCountryFromNumber = (number, countryCodes) => {
  if (!number) return 'Unknown';

  // remove + or 00
  let cleaned = number.toString().replace(/^(\+|00)/, '');

  // sort country codes by length (longest first)
  const sortedCodes = [...countryCodes].sort(
    (a, b) => b.code.length - a.code.length
  );

  for (const cc of sortedCodes) {
    if (cleaned.startsWith(cc.code)) {
      return cc.country_name;
    }
  }

  return 'Unknown';
};

/* ===================== HELPER: GET TRUNK NAME ===================== */
const getTrunkName = (number) => {
  if (!number) return 'Unknown';
  const trunkPrefix = number.toString().substring(0, 5);
  if (trunkPrefix.startsWith('10')) return 'NCLI';
  if (trunkPrefix.startsWith('20')) return 'CLI';
  if (trunkPrefix.startsWith('30')) return 'ORTP/TDM';
  if (trunkPrefix.startsWith('40')) return 'CC';
  return 'Unknown';
};

/* ===================== HELPER: BUILD ACCOUNT CONDITIONS ===================== */
const buildAccountConditions = (account, vendorReport = false) => {
  const or = [];

  let authType, authValue;

  if (vendorReport) {
    authType = account.vendorauthenticationType;
    authValue = account.vendorauthenticationValue;
  } else {
    authType = account.customerauthenticationType;
    authValue = account.customerauthenticationValue;
  }

  // 1️⃣ IP authentication
  if (authType === 'ip' && authValue) {
    if (vendorReport) {
      or.push({ calleeip: authValue });
    } else {
      or.push({ callerip: authValue });
    }
  }

  // 2️⃣ Custom authentication → search in account fields
  if (authType === 'custom' && authValue) {
    const v = `${authValue}`;
    if (vendorReport) {
      or.push({ agentaccount: { [Op.like]: v } });
      or.push({ agentname: { [Op.like]: v } });
    } else {
      or.push({ customeraccount: { [Op.like]: v } });
      or.push({ customername: { [Op.like]: v } });
    }
  }

  // 3️⃣ Fallback to vendorCode/customerCode or gatewayId if nothing else matched
  if (or.length === 0) {
    if (vendorReport) {
      const vCode = account.vendorCode || account.gatewayId;
      if (vCode) or.push({ agentaccount: vCode });
    } else {
      const cCode = account.customerCode || account.gatewayId;
      if (cCode) or.push({ customeraccount: cCode });
    }
  }

  return or;
};

class InvoiceService {
  
  /**
   * Find customer by multiple identifiers
   */
  async findCustomer(customerId, isVendor = false) {
    const isNumeric = /^\d+$/.test(customerId);
    const accountWhere = {
      [Op.or]: [
        { gatewayId: customerId },
        { [isVendor ? 'vendorCode' : 'customerCode']: customerId }
      ]
    };
    if (isNumeric) accountWhere[Op.or].push({ accountId: customerId });

    const customer = await Account.findOne({
      where: accountWhere
    });

    if (!customer) {
      throw new Error(`${isVendor ? 'Vendor' : 'Customer'} not found: ${customerId}`);
    }

    return customer;
  }

  /**
   * Calculate next invoice number
   */
  async generateInvoiceNumber() {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    
    const lastInvoice = await Invoice.findOne({
      where: {
        invoiceNumber: {
          [Op.like]: `${billingConfig.invoiceNumbering.prefix}-${year}-${month}-%`
        }
      },
      order: [['createdAt', 'DESC']]
    });
    
    let sequence = 1;
    if (lastInvoice) {
      const lastNumber = lastInvoice.invoiceNumber.split('-').pop();
      sequence = parseInt(lastNumber) + 1;
    }
    
    return `${billingConfig.invoiceNumbering.prefix}-${year}-${month}-${String(sequence).padStart(4, '0')}`;
  }

  /**
   * Generate invoice from CDRs
   */
  async generateInvoiceFromCDRs({
    customerId,
    invoiceType = 'customer',
    billingPeriodStart,
    billingPeriodEnd,
    taxRate = 0,
    discountAmount = 0,
    dueInDays = 7,
    notes,
    customerNotes,
    generatedBy = null
  }) {
    const transaction = await sequelize.transaction();
    
    try {
      const isVendor = invoiceType === 'vendor';

      // Get account details
      const account = await this.findCustomer(customerId, isVendor);

      // Get country codes for mapping
      const countryCodes = await CountryCode.findAll({ raw: true });

      // ✅ Build CDR WHERE conditions using authentication logic
      const authConditions = buildAccountConditions(account, isVendor);
      
      if (authConditions.length === 0) {
        throw new Error(`Unable to build authentication conditions for this ${isVendor ? 'vendor' : 'customer'}`);
      }

      const cdrWhere = {
        starttime: {
          [Op.between]: [formatTime(billingPeriodStart), formatTime(billingPeriodEnd, 23, true)]
        },
        [Op.or]: authConditions
      };

      // Fetch CDR data
      const cdrs = await CDR.findAll({
        attributes: [
          isVendor ? 'agentaccount' : 'customeraccount',
          isVendor ? 'agentname' : 'customername',
          'callere164',
          'calleee164',
          'calleegatewayid',
          [fn('COUNT', col('*')), 'totalCalls'],
          [fn('SUM', H.completedCall), 'completedCalls'],
          [fn('SUM', H.failedCall), 'failedCalls'],
          [fn('SUM', H.durationSec), 'duration'],
          [fn('SUM', isVendor ? H.cost : H.revenue), 'revenue']
        ],
        where: cdrWhere,
        group: [isVendor ? 'agentaccount' : 'customeraccount', isVendor ? 'agentname' : 'customername', 'callere164', 'calleee164', 'calleegatewayid'],
        raw: true
      });

      if (cdrs.length === 0) {
        throw new Error(`No CDR records found for this ${isVendor ? 'vendor' : 'customer'} in the billing period`);
      }

      // Group CDRs
      const groupedData = {};
      cdrs.forEach(cdr => {
        let destination = 'Unknown';
        let prefix = '';
        
        const fullCalleee = cdr.calleee164 ? cdr.calleee164.toString().replace(/^\+/, '') : '';
        const actualCalleee = fullCalleee.length > 5 ? fullCalleee.substring(5) : fullCalleee;
        
        const phoneNumber = parsePhoneNumberFromString('+' + actualCalleee);
        
        if (phoneNumber) {
          destination = getCountryFromNumber(actualCalleee, countryCodes);
          prefix = phoneNumber.countryCallingCode;
        } else {
          destination = getCountryFromNumber(actualCalleee, countryCodes);
          prefix = actualCalleee.length >= 6 ? actualCalleee.substring(0, 3) : actualCalleee;
        }

        const trunk = getTrunkName(cdr.calleee164);
        
        let customDescription = '';
        if (cdr.calleegatewayid) {
          const parts = cdr.calleegatewayid.split('--');
          if (parts.length >= 3) {
            customDescription = parts[2].trim();
          }
        }

        const key = `${destination}|${prefix}|${trunk}|${customDescription}`;
        
        if (!groupedData[key]) {
          groupedData[key] = {
            destination,
            trunk,
            prefix,
            customDescription,
            totalCalls: 0,
            completedCalls: 0,
            failedCalls: 0,
            duration: 0,
            revenue: 0
          };
        }
        
        groupedData[key].totalCalls += Number(cdr.totalCalls);
        groupedData[key].completedCalls += Number(cdr.completedCalls);
        groupedData[key].failedCalls += Number(cdr.failedCalls);
        groupedData[key].duration += Number(cdr.duration);
        groupedData[key].revenue += Number(cdr.revenue);
      });

      // Generate invoice
      const invoiceNumber = await this.generateInvoiceNumber();
      const invoiceDate = Date.now().toString();
      const dueDate = (Date.now() + (dueInDays * 24 * 60 * 60 * 1000)).toString();

      // Calculate subtotal
      let subtotal = 0;
      let totalCallsCount = 0;
      const invoiceItemsData = Object.values(groupedData)
        .filter(item => item.completedCalls > 0)
        .map((item, index) => {
        
        const amount = Number(item.revenue);
        subtotal += amount;
        totalCallsCount += Number(item.totalCalls);

        return {
          itemType: 'call_charges',
          description: item.customDescription || `Calls to ${item.destination} (${item.trunk})`,
          destination: item.destination,
          trunk: item.trunk,
          prefix: item.prefix,
          quantity: item.totalCalls,
          duration: item.duration,
          unitPrice: item.totalCalls > 0 ? (amount / item.totalCalls) : 0,
          amount: parseFloat(amount.toFixed(4)),
          totalCalls: item.totalCalls,
          completedCalls: item.completedCalls,
          failedCalls: item.failedCalls,
          asr: item.totalCalls > 0 ? parseFloat(((item.completedCalls / item.totalCalls) * 100).toFixed(2)) : 0,
          acd: item.completedCalls > 0 ? parseFloat((item.duration / item.completedCalls).toFixed(2)) : 0,
          taxable: true,
          periodStart: formatTime(billingPeriodStart),
          periodEnd: formatTime(billingPeriodEnd, 23, true),
          sortOrder: index
        };
      });

      if (invoiceItemsData.length === 0) {
        throw new Error('No successful calls found for this customer in the billing period');
      }

      const taxAmount = (subtotal * (taxRate / 100));
      const totalAmount = subtotal + taxAmount - discountAmount;

      const customerGatewayId = (isVendor ? (account.vendorauthenticationType === 'gateway' && account.vendorauthenticationValue) : (account.customerauthenticationType === 'gateway' && account.customerauthenticationValue))
        ? (isVendor ? account.vendorauthenticationValue : account.customerauthenticationValue)
        : account.gatewayId;

      const invoice = await Invoice.create({
        invoiceNumber,
        invoiceType,
        customerGatewayId,
        customerName: account.accountName,
        customerCode: isVendor ? account.vendorCode : account.customerCode,
        customerEmail: account.email,
        customerAddress: account.addressLine1 + (account.addressLine2 ? ', ' + account.addressLine2 : ''),
        customerPhone: account.phone,
        billingPeriodStart: formatTime(billingPeriodStart),
        billingPeriodEnd: formatTime(billingPeriodEnd, 23, true),
        invoiceDate,
        dueDate,
        subtotal: parseFloat(subtotal.toFixed(4)),
        taxRate,
        taxAmount: parseFloat(taxAmount.toFixed(4)),
        discountAmount: parseFloat(discountAmount),
        totalAmount: parseFloat(totalAmount.toFixed(4)),
        balanceAmount: parseFloat(totalAmount.toFixed(4)),
        totalCalls: totalCallsCount,
        status: 'pending',
        notes,
        customerNotes,
        generatedBy
      }, { transaction });

      for (const item of invoiceItemsData) {
        await InvoiceItem.create({
          invoiceId: invoice.id,
          ...item
        }, { transaction });
      }

      // Update account balance/credit limit
      if (account.billingType === 'postpaid') {
        if (Number(account.creditLimit) < totalAmount) {
          throw new Error('Credit limit exceeded – cannot generate invoice');
        }
        await account.decrement('creditLimit', { by: totalAmount, transaction });
      } else {
        // Prepaid invoices must still be generated even when balance is insufficient.
        // This allows balance to move into negative values (debt state).
        await account.decrement('balance', { by: totalAmount, transaction });
      }

      await transaction.commit();

      return await Invoice.findByPk(invoice.id, {
        include: [{
          model: InvoiceItem,
          as: 'items'
        }]
      });

    } catch (error) {
      if (transaction) await transaction.rollback();
      throw error;
    }
  }

  /**
   * Calculate invoice dates
   */
  calculateInvoiceDates(dueInDays = null) {
    const invoiceDate = Date.now();
    const days = dueInDays || billingConfig.payment.defaultDueInDays;
    const dueDate = (Date.now() + (days * 24 * 60 * 60 * 1000));
    
    return { invoiceDate, dueDate };
  }

  /**
   * Calculate invoice totals
   */
  calculateInvoiceTotals(subtotal, taxRate = null, discountAmount = 0) {
    const rate = taxRate !== null ? taxRate : billingConfig.tax.defaultRate;
    const taxAmount = billingConfig.tax.enabled ? (subtotal * (rate / 100)) : 0;
    const totalAmount = subtotal + taxAmount - discountAmount;
    
    return {
      taxAmount: parseFloat(taxAmount.toFixed(4)),
      totalAmount: parseFloat(totalAmount.toFixed(4)),
      balanceAmount: parseFloat(totalAmount.toFixed(4))
    };
  }

  /**
   * Update invoice status based on payment
   */
  async updateInvoiceStatus(invoiceId) {
    const invoice = await Invoice.findByPk(invoiceId);
    
    if (!invoice) {
      throw new Error(`Invoice not found: ${invoiceId}`);
    }

    const paidAmount = Number(invoice.paidAmount);
    const totalAmount = Number(invoice.totalAmount);
    const balance = totalAmount - paidAmount;

    let newStatus = invoice.status;
    
    if (balance <= 0.01) { // Account for floating point
      newStatus = 'paid';
    } else if (paidAmount > 0) {
      newStatus = 'partial';
    } else if (Number(invoice.dueDate) < Date.now() && balance > 0) {
      newStatus = 'overdue';
    }

    if (newStatus !== invoice.status) {
      await invoice.update({ 
        status: newStatus,
        balanceAmount: parseFloat(balance.toFixed(4))
      });

      // restore credit for postpaid customers when invoice becomes paid
      if (newStatus === 'paid') {
        const customer = await Account.findOne({
          where: {
            [Op.or]: [
              { gatewayId: invoice.customerGatewayId },
              { customerCode: invoice.customerCode },
              { accountName: invoice.customerName }
            ]
          }
        });

        if (customer && customer.billingType === 'postpaid') {
          const orig = parseFloat(customer.originalCreditLimit) || 0;
          const restoreAmt = Number(invoice.totalAmount) - Number(invoice.paidAmount || 0);
          if (restoreAmt > 0) {
            let newLimit = parseFloat(customer.creditLimit) + restoreAmt;
            if (orig && newLimit > orig) newLimit = orig;
            await customer.update({ creditLimit: newLimit });
          }
        }
      }
    }

    return invoice;
  }

  /**
   * Check if invoice can be edited
   */
  canEditInvoice(invoice) {
    const editableStatuses = ['draft', 'pending'];
    return editableStatuses.includes(invoice.status);
  }

  /**
   * Check if invoice can be deleted
   */
  canDeleteInvoice(invoice) {
    const deletableStatuses = ['draft', 'cancelled', 'void'];
    return deletableStatuses.includes(invoice.status);
  }

  /**
   * Check if invoice can be paid
   */
  canPayInvoice(invoice) {
    const payableStatuses = ['pending', 'sent', 'partial', 'overdue'];
    return payableStatuses.includes(invoice.status) && Number(invoice.balanceAmount) > 0;
  }

  /**
   * Send invoice to customer (placeholder)
   */
  async sendInvoice(invoiceId) {
    const invoice = await Invoice.findByPk(invoiceId, {
      include: [{
        model: InvoiceItem,
        as: 'items'
      }]
    });

    if (!invoice) {
      throw new Error(`Invoice not found: ${invoiceId}`);
    }

    // TODO: Implement email sending
    console.log(`Sending invoice ${invoice.invoiceNumber} to ${invoice.customerEmail}`);
    
    // Update sent date and status
    await invoice.update({
      sentDate: Date.now(),
      status: invoice.status === 'draft' ? 'sent' : invoice.status
    });

    return invoice;
  }

  /**
   * Void an invoice
   */
  async voidInvoice(invoiceId, reason = null) {
    const transaction = await sequelize.transaction();
    
    try {
      const invoice = await Invoice.findByPk(invoiceId, { transaction });
      
      if (!invoice) {
        throw new Error(`Invoice not found: ${invoiceId}`);
      }

      if (invoice.status === 'paid') {
        throw new Error('Cannot void a paid invoice. Issue a credit note instead.');
      }

      if (Number(invoice.paidAmount) > 0) {
        throw new Error('Cannot void an invoice with payments. Refund payments first.');
      }

      await invoice.update({
        status: 'void',
        notes: invoice.notes ? `${invoice.notes}\n\nVOIDED: ${reason || 'No reason provided'}` : `VOIDED: ${reason || 'No reason provided'}`
      }, { transaction });

      await transaction.commit();
      return invoice;
      
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Get invoice summary statistics
   */
  async getInvoiceSummary(filters = {}) {
    const where = {};

    if (filters.customerGatewayId) {
      where.customerGatewayId = filters.customerGatewayId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.startDate && filters.endDate) {
      where.invoiceDate = {
        [Op.between]: [formatTime(filters.startDate), formatTime(filters.endDate, 23, true)]
      };
    }

    const invoices = await Invoice.findAll({ where });

    const summary = {
      totalInvoices: invoices.length,
      totalAmount: 0,
      totalPaid: 0,
      totalOutstanding: 0,
      byStatus: {}
    };

    invoices.forEach(inv => {
      summary.totalAmount += Number(inv.totalAmount);
      summary.totalPaid += Number(inv.paidAmount);
      summary.totalOutstanding += Number(inv.balanceAmount);

      if (!summary.byStatus[inv.status]) {
        summary.byStatus[inv.status] = {
          count: 0,
          amount: 0
        };
      }
      summary.byStatus[inv.status].count++;
      summary.byStatus[inv.status].amount += Number(inv.totalAmount);
    });

    return summary;
  }

  /**
   * Get overdue invoices
   */
  async getOverdueInvoices(customerGatewayId = null) {
    const where = {
      status: {
        [Op.in]: ['pending', 'sent', 'partial', 'overdue']
      },
      dueDate: {
        [Op.lt]: Date.now()
      },
      balanceAmount: {
        [Op.gt]: 0
      }
    };

    if (customerGatewayId) {
      where.customerGatewayId = customerGatewayId;
    }

    const invoices = await Invoice.findAll({
      where,
      order: [['dueDate', 'ASC']]
    });

    return invoices;
  }

  /**
   * Apply late fee to overdue invoice
   */
  async applyLateFee(invoiceId) {
    const transaction = await sequelize.transaction();
    
    try {
      const invoice = await Invoice.findByPk(invoiceId, { transaction });
      
      if (!invoice) {
        throw new Error(`Invoice not found: ${invoiceId}`);
      }

      if (invoice.status !== 'overdue') {
        throw new Error('Invoice is not overdue');
      }

      const lateFeeAmount = Number(invoice.totalAmount) * (billingConfig.payment.lateFeePercentage / 100);

      // Add late fee as invoice item
      await InvoiceItem.create({
        invoiceId: invoice.id,
        itemType: 'adjustment',
        description: `Late fee (${billingConfig.payment.lateFeePercentage}%)`,
        quantity: 1,
        unitPrice: lateFeeAmount,
        amount: lateFeeAmount,
        taxable: false,
        sortOrder: 999
      }, { transaction });

      // Update invoice totals
      const newTotal = Number(invoice.totalAmount) + lateFeeAmount;
      const newBalance = Number(invoice.balanceAmount) + lateFeeAmount;

      await invoice.update({
        totalAmount: parseFloat(newTotal.toFixed(4)),
        balanceAmount: parseFloat(newBalance.toFixed(4))
      }, { transaction });

      await transaction.commit();
      return invoice;
      
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}

module.exports = new InvoiceService();