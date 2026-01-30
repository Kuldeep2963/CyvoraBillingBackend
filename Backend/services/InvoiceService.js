/**
 * Invoice Service
 * 
 * Business logic layer for invoice operations
 * Separates business logic from controller/routes
 */

const { Op } = require('sequelize');
const sequelize = require('../config/database');
const Invoice = require('../models/Invoice');
const InvoiceItem = require('../models/InvoiceItem');
const Account = require('../models/Account');
const billingConfig = require('../config/billing.config');

class InvoiceService {
  
  /**
   * Find customer by multiple identifiers
   */
  async findCustomer(customerId) {
    const customer = await Account.findOne({
      where: {
        [Op.or]: [
          { gatewayId: customerId },
          { customerCode: customerId },
          { accountId: customerId }
        ]
      }
    });

    if (!customer) {
      throw new Error(`Customer not found: ${customerId}`);
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
   * Calculate invoice dates
   */
  calculateInvoiceDates(dueInDays = null) {
    const invoiceDate = Date.now().toString();
    const days = dueInDays || billingConfig.payment.defaultDueInDays;
    const dueDate = (Date.now() + (days * 24 * 60 * 60 * 1000)).toString();
    
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
      sentDate: Date.now().toString(),
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
        [Op.between]: [filters.startDate, filters.endDate]
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
        [Op.lt]: Date.now().toString()
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