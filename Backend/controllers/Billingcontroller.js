const { Op, fn, col } = require('sequelize');
const sequelize = require('../config/database');
const Invoice = require('../models/Invoice');
const InvoiceItem = require('../models/InvoiceItem');
const Payment = require('../models/Payment');
const PaymentAllocation = require('../models/PaymentAllocation');
const CDR = require('../models/CDR');
const Account = require('../models/Account');
const CountryCode = require('../models/CountryCode');

/* ===================== HELPER: FORMAT TIME ===================== */
const formatTime = (date, hour = 0, isEnd = false) => {
  const d = new Date(date);
  d.setHours(hour, isEnd ? 59 : 0, isEnd ? 59 : 0, isEnd ? 999 : 0);
  return d.getTime().toString();
};

/* ===================== HELPER: GET COUNTRY FROM NUMBER ===================== */
const getCountryFromNumber = (number, countryCodes, skipPrefix = false) => {
  if (!number) return 'Unknown';
  let cleaned = number.toString().replace(/^(\+|00)/, '');
  
  if (skipPrefix && cleaned.length > 5) {
    cleaned = cleaned.substring(5);
  }
  
  const sortedCodes = [...countryCodes].sort((a, b) => b.code.length - a.code.length);
  for (const cc of sortedCodes) {
    if (cleaned.startsWith(cc.code)) {
      return cc.country_name;
    }
  }
  return 'Unknown';
};

/* ===================== HELPER: GENERATE INVOICE NUMBER ===================== */
const generateInvoiceNumber = async () => {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  
  const lastInvoice = await Invoice.findOne({
    where: {
      invoiceNumber: {
        [Op.like]: `INV-${year}-${month}-%`
      }
    },
    order: [['createdAt', 'DESC']]
  });
  
  let sequence = 1;
  if (lastInvoice) {
    const lastNumber = lastInvoice.invoiceNumber.split('-').pop();
    sequence = parseInt(lastNumber) + 1;
  }
  
  return `INV-${year}-${month}-${String(sequence).padStart(4, '0')}`;
};

/* ===================== HELPER: GENERATE PAYMENT NUMBER ===================== */
const generatePaymentNumber = async () => {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  
  const lastPayment = await Payment.findOne({
    where: {
      paymentNumber: {
        [Op.like]: `PAY-${year}-${month}-%`
      }
    },
    order: [['createdAt', 'DESC']]
  });
  
  let sequence = 1;
  if (lastPayment) {
    const lastNumber = lastPayment.paymentNumber.split('-').pop();
    sequence = parseInt(lastNumber) + 1;
  }
  
  return `PAY-${year}-${month}-${String(sequence).padStart(4, '0')}`;
};

/* ===================== GENERATE INVOICE FROM CDRs ===================== */
exports.generateInvoice = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const {
      customerId,
      billingPeriodStart,
      billingPeriodEnd,
      taxRate = 0,
      discountAmount = 0,
      dueInDays = 30,
      notes,
      customerNotes
    } = req.body;

    // Validate required fields
    if (!customerId || !billingPeriodStart || !billingPeriodEnd) {
      return res.status(400).json({
        success: false,
        error: 'customerId, billingPeriodStart, and billingPeriodEnd are required'
      });
    }

    // Get customer details - find by gatewayId, customerCode, or accountId
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
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }

    // Get country codes for mapping
    const countryCodes = await CountryCode.findAll({ raw: true });

    // Fetch CDR data for the billing period using gatewayId
    const cdrs = await CDR.findAll({
      attributes: [
        'customeraccount',
        'customername',
        'callere164',
        [fn('COUNT', col('*')), 'totalCalls'],
        [fn('SUM', fn('CASE', fn('WHEN', col('disposition'), '=', 'ANSWERED'), fn('THEN', 1), fn('ELSE', 0))), 'completedCalls'],
        [fn('SUM', fn('CASE', fn('WHEN', col('disposition'), '!=', 'ANSWERED'), fn('THEN', 1), fn('ELSE', 0))), 'failedCalls'],
        [fn('SUM', col('billsec')), 'duration'],
        [fn('SUM', col('customerprice')), 'revenue']
      ],
      where: {
        customeraccount: customer.gatewayId,
        starttime: {
          [Op.between]: [billingPeriodStart, billingPeriodEnd]
        }
      },
      group: ['customeraccount', 'customername', 'callere164'],
      raw: true
    });

    if (cdrs.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No CDR records found for this customer in the billing period'
      });
    }

    // Group CDRs by destination country
    const groupedByDestination = {};
    cdrs.forEach(cdr => {
      const destination = getCountryFromNumber(cdr.callere164, countryCodes, false);
      
      if (!groupedByDestination[destination]) {
        groupedByDestination[destination] = {
          destination,
          totalCalls: 0,
          completedCalls: 0,
          failedCalls: 0,
          duration: 0,
          revenue: 0
        };
      }
      
      groupedByDestination[destination].totalCalls += Number(cdr.totalCalls);
      groupedByDestination[destination].completedCalls += Number(cdr.completedCalls);
      groupedByDestination[destination].failedCalls += Number(cdr.failedCalls);
      groupedByDestination[destination].duration += Number(cdr.duration);
      groupedByDestination[destination].revenue += Number(cdr.revenue);
    });

    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber();
    const invoiceDate = Date.now().toString();
    const dueDate = (Date.now() + (dueInDays * 24 * 60 * 60 * 1000)).toString();

    // Calculate subtotal
    let subtotal = 0;
    const invoiceItems = Object.values(groupedByDestination).map((item, index) => {
      const durationMinutes = (item.duration / 60).toFixed(2);
      const amount = Number(item.revenue);
      subtotal += amount;

      return {
        itemType: 'call_charges',
        description: `Calls to ${item.destination}`,
        destination: item.destination,
        quantity: item.totalCalls,
        duration: item.duration,
        durationMinutes: parseFloat(durationMinutes),
        unitPrice: item.totalCalls > 0 ? (amount / item.totalCalls) : 0,
        amount: parseFloat(amount.toFixed(4)),
        totalCalls: item.totalCalls,
        completedCalls: item.completedCalls,
        failedCalls: item.failedCalls,
        asr: item.totalCalls > 0 ? parseFloat(((item.completedCalls / item.totalCalls) * 100).toFixed(2)) : 0,
        acd: item.completedCalls > 0 ? parseFloat((item.duration / item.completedCalls).toFixed(2)) : 0,
        taxable: true,
        periodStart: billingPeriodStart,
        periodEnd: billingPeriodEnd,
        sortOrder: index
      };
    });

    // Calculate tax and total
    const taxAmount = (subtotal * (taxRate / 100));
    const totalAmount = subtotal + taxAmount - discountAmount;

    // Create invoice using gatewayId
    const invoice = await Invoice.create({
      invoiceNumber,
      customerGatewayId: customer.gatewayId,
      customerName: customer.accountName,
      customerCode: customer.customerCode,
      customerEmail: customer.email,
      customerAddress: customer.address,
      customerPhone: customer.phone,
      billingPeriodStart,
      billingPeriodEnd,
      invoiceDate,
      dueDate,
      subtotal: parseFloat(subtotal.toFixed(4)),
      taxRate,
      taxAmount: parseFloat(taxAmount.toFixed(4)),
      discountAmount: parseFloat(discountAmount),
      totalAmount: parseFloat(totalAmount.toFixed(4)),
      balanceAmount: parseFloat(totalAmount.toFixed(4)),
      status: 'pending',
      notes,
      customerNotes,
      generatedBy: req.user?.id || null
    }, { transaction });

    // Create invoice items
    for (const item of invoiceItems) {
      await InvoiceItem.create({
        invoiceId: invoice.id,
        ...item
      }, { transaction });
    }

    await transaction.commit();

    // Fetch complete invoice with items
    const completeInvoice = await Invoice.findByPk(invoice.id, {
      include: [{
        model: InvoiceItem,
        as: 'items'
      }]
    });

    res.json({
      success: true,
      message: 'Invoice generated successfully',
      invoice: completeInvoice
    });

  } catch (error) {
    await transaction.rollback();
    console.error('Generate Invoice Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/* ===================== GET ALL INVOICES ===================== */
exports.getAllInvoices = async (req, res) => {
  try {
    const {
      customerId,
      status,
      startDate,
      endDate,
      page = 1,
      limit = 50
    } = req.query;

    const where = {};

    if (customerId) {
      const customer = await Account.findOne({
        where: {
          [Op.or]: [
            { gatewayId: customerId },
            { customerCode: customerId },
            { accountId: customerId }
          ]
        }
      });
      if (customer) {
        where.customerGatewayId = customer.gatewayId;
      }
    }

    if (status) {
      where.status = status;
    }

    if (startDate && endDate) {
      where.invoiceDate = {
        [Op.between]: [startDate, endDate]
      };
    }

    const offset = (page - 1) * limit;

    const { count, rows } = await Invoice.findAndCountAll({
      where,
      include: [{
        model: InvoiceItem,
        as: 'items'
      }],
      order: [['invoiceDate', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      }
    });

  } catch (error) {
    console.error('Get All Invoices Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/* ===================== GET INVOICE BY ID ===================== */
exports.getInvoiceById = async (req, res) => {
  try {
    const { id } = req.params;

    const invoice = await Invoice.findOne({
      where: {
        [Op.or]: [
          { id },
          { invoiceNumber: id }
        ]
      },
      include: [{
        model: InvoiceItem,
        as: 'items',
        order: [['sortOrder', 'ASC']]
      }]
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found'
      });
    }

    res.json({
      success: true,
      invoice
    });

  } catch (error) {
    console.error('Get Invoice By ID Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/* ===================== UPDATE INVOICE ===================== */
exports.updateInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const invoice = await Invoice.findByPk(id);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found'
      });
    }

    // Prevent updating certain fields if invoice is paid
    if (invoice.status === 'paid' && (updateData.totalAmount || updateData.items)) {
      return res.status(400).json({
        success: false,
        error: 'Cannot modify amount of a paid invoice'
      });
    }

    await invoice.update(updateData);

    const updatedInvoice = await Invoice.findByPk(id, {
      include: [{
        model: InvoiceItem,
        as: 'items'
      }]
    });

    res.json({
      success: true,
      message: 'Invoice updated successfully',
      invoice: updatedInvoice
    });

  } catch (error) {
    console.error('Update Invoice Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/* ===================== DELETE INVOICE ===================== */
exports.deleteInvoice = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;

    const invoice = await Invoice.findByPk(id);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found'
      });
    }

    // Only allow deletion of draft or cancelled invoices
    if (!['draft', 'cancelled', 'void'].includes(invoice.status)) {
      return res.status(400).json({
        success: false,
        error: 'Only draft, cancelled, or void invoices can be deleted'
      });
    }

    // Delete invoice items
    await InvoiceItem.destroy({
      where: { invoiceId: id },
      transaction
    });

    // Delete invoice
    await invoice.destroy({ transaction });

    await transaction.commit();

    res.json({
      success: true,
      message: 'Invoice deleted successfully'
    });

  } catch (error) {
    await transaction.rollback();
    console.error('Delete Invoice Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/* ===================== RECORD PAYMENT ===================== */
exports.recordPayment = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const {
      customerId,
      amount,
      paymentDate,
      paymentMethod,
      transactionId,
      referenceNumber,
      notes,
      invoiceAllocations = [] // Array of { invoiceId, amount }
    } = req.body;

    // Validate
    if (!customerId || !amount || !paymentDate || !paymentMethod) {
      return res.status(400).json({
        success: false,
        error: 'customerId, amount, paymentDate, and paymentMethod are required'
      });
    }

    // Get customer by gatewayId
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
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }

    // Generate payment number
    const paymentNumber = await generatePaymentNumber();
    const receiptNumber = `RCP-${paymentNumber.split('-').slice(1).join('-')}`;

    // Calculate allocated and unapplied amounts
    let totalAllocated = 0;
    if (invoiceAllocations.length > 0) {
      totalAllocated = invoiceAllocations.reduce((sum, alloc) => sum + Number(alloc.amount), 0);
    }

    if (totalAllocated > amount) {
      return res.status(400).json({
        success: false,
        error: 'Total allocated amount cannot exceed payment amount'
      });
    }

    // Create payment using gatewayId
    const payment = await Payment.create({
      paymentNumber,
      receiptNumber,
      customerGatewayId: customer.gatewayId,
      customerName: customer.accountName,
      amount: parseFloat(amount),
      paymentDate,
      paymentMethod,
      transactionId,
      referenceNumber,
      status: 'completed',
      allocatedAmount: parseFloat(totalAllocated),
      unappliedAmount: parseFloat(amount - totalAllocated),
      notes,
      recordedBy: req.user?.id || null,
      recordedDate: Date.now().toString()
    }, { transaction });

    // Create allocations and update invoices
    for (const allocation of invoiceAllocations) {
      const invoice = await Invoice.findByPk(allocation.invoiceId, { transaction });
      
      if (!invoice) {
        throw new Error(`Invoice ${allocation.invoiceId} not found`);
      }

      // Verify invoice belongs to this customer
      if (invoice.customerGatewayId !== customer.gatewayId) {
        throw new Error(`Invoice ${allocation.invoiceId} does not belong to customer ${customer.gatewayId}`);
      }

      // Create allocation
      await PaymentAllocation.create({
        paymentId: payment.id,
        invoiceId: allocation.invoiceId,
        allocatedAmount: parseFloat(allocation.amount),
        allocationDate: paymentDate,
        allocatedBy: req.user?.id || null
      }, { transaction });

      // Update invoice
      const newPaidAmount = Number(invoice.paidAmount) + Number(allocation.amount);
      const newBalance = Number(invoice.totalAmount) - newPaidAmount;

      let newStatus = invoice.status;
      if (newBalance <= 0) {
        newStatus = 'paid';
      } else if (newPaidAmount > 0) {
        newStatus = 'partial';
      }

      await invoice.update({
        paidAmount: parseFloat(newPaidAmount.toFixed(4)),
        balanceAmount: parseFloat(newBalance.toFixed(4)),
        status: newStatus,
        paymentDate: newStatus === 'paid' ? paymentDate : invoice.paymentDate
      }, { transaction });
    }

    await transaction.commit();

    // Fetch complete payment with allocations
    const completePayment = await Payment.findByPk(payment.id, {
      include: [{
        model: PaymentAllocation,
        as: 'allocations',
        include: [{
          model: Invoice,
          as: 'invoice'
        }]
      }]
    });

    res.json({
      success: true,
      message: 'Payment recorded successfully',
      payment: completePayment
    });

  } catch (error) {
    await transaction.rollback();
    console.error('Record Payment Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/* ===================== GET CUSTOMER OUTSTANDING ===================== */
exports.getCustomerOutstanding = async (req, res) => {
  try {
    const { customerId } = req.params;

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
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }

    const invoices = await Invoice.findAll({
      where: {
        customerGatewayId: customer.gatewayId,
        status: {
          [Op.in]: ['pending', 'sent', 'partial', 'overdue']
        }
      },
      order: [['dueDate', 'ASC']]
    });

    const totalOutstanding = invoices.reduce((sum, inv) => sum + Number(inv.balanceAmount), 0);
    const overdueInvoices = invoices.filter(inv => Number(inv.dueDate) < Date.now());
    const totalOverdue = overdueInvoices.reduce((sum, inv) => sum + Number(inv.balanceAmount), 0);

    res.json({
      success: true,
      customer: {
        gatewayId: customer.gatewayId,
        name: customer.accountName,
        code: customer.customerCode
      },
      summary: {
        totalOutstanding: parseFloat(totalOutstanding.toFixed(2)),
        totalOverdue: parseFloat(totalOverdue.toFixed(2)),
        invoiceCount: invoices.length,
        overdueCount: overdueInvoices.length
      },
      invoices
    });

  } catch (error) {
    console.error('Get Customer Outstanding Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/* ===================== GET AGING REPORT ===================== */
exports.getAgingReport = async (req, res) => {
  try {
    const now = Date.now();
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = now - (60 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = now - (90 * 24 * 60 * 60 * 1000);

    const invoices = await Invoice.findAll({
      where: {
        status: {
          [Op.in]: ['pending', 'sent', 'partial', 'overdue']
        }
      },
      order: [['customerGatewayId', 'ASC'], ['dueDate', 'ASC']]
    });

    const customerAging = {};

    invoices.forEach(invoice => {
      const balance = Number(invoice.balanceAmount);
      const dueDate = Number(invoice.dueDate);
      
      if (!customerAging[invoice.customerGatewayId]) {
        customerAging[invoice.customerGatewayId] = {
          customerGatewayId: invoice.customerGatewayId,
          customerName: invoice.customerName,
          customerCode: invoice.customerCode,
          current: 0,
          days1_30: 0,
          days31_60: 0,
          days61_90: 0,
          days90Plus: 0,
          total: 0
        };
      }

      if (dueDate >= now) {
        customerAging[invoice.customerGatewayId].current += balance;
      } else if (dueDate >= thirtyDaysAgo) {
        customerAging[invoice.customerGatewayId].days1_30 += balance;
      } else if (dueDate >= sixtyDaysAgo) {
        customerAging[invoice.customerGatewayId].days31_60 += balance;
      } else if (dueDate >= ninetyDaysAgo) {
        customerAging[invoice.customerGatewayId].days61_90 += balance;
      } else {
        customerAging[invoice.customerGatewayId].days90Plus += balance;
      }

      customerAging[invoice.customerGatewayId].total += balance;
    });

    const agingData = Object.values(customerAging).map(customer => ({
      ...customer,
      current: parseFloat(customer.current.toFixed(2)),
      days1_30: parseFloat(customer.days1_30.toFixed(2)),
      days31_60: parseFloat(customer.days31_60.toFixed(2)),
      days61_90: parseFloat(customer.days61_90.toFixed(2)),
      days90Plus: parseFloat(customer.days90Plus.toFixed(2)),
      total: parseFloat(customer.total.toFixed(2))
    }));

    const totals = {
      current: agingData.reduce((sum, c) => sum + c.current, 0),
      days1_30: agingData.reduce((sum, c) => sum + c.days1_30, 0),
      days31_60: agingData.reduce((sum, c) => sum + c.days31_60, 0),
      days61_90: agingData.reduce((sum, c) => sum + c.days61_90, 0),
      days90Plus: agingData.reduce((sum, c) => sum + c.days90Plus, 0),
      total: agingData.reduce((sum, c) => sum + c.total, 0)
    };

    res.json({
      success: true,
      data: agingData,
      totals
    });

  } catch (error) {
    console.error('Get Aging Report Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

module.exports = exports;