const { Op, fn, col } = require('sequelize');
const { parsePhoneNumberFromString } = require('libphonenumber-js');
const sequelize = require('../config/database');
const H = require('../utils/reportHelper');
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
  if (isNaN(d.getTime())) return null;
  d.setHours(hour, isEnd ? 59 : 0, isEnd ? 59 : 0, isEnd ? 999 : 0);
  return d.getTime();
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

/* ===================== HELPER: GET TRUNK NAME ===================== */
const getTrunkName = (number) => {
  if (!number) return 'Unknown';
  const trunkPrefix = number.toString().substring(0, 5);
  if (trunkPrefix.startsWith('10')) return 'NCLI';
  if (trunkPrefix.startsWith('20')) return 'CLI';
  if (trunkPrefix.startsWith('30')) return 'ortp/TDM';
  if (trunkPrefix.startsWith('40')) return 'CC';
  return 'Unknown';
};

/* ===================== HELPER: BUILD ACCOUNT CONDITIONS ===================== */
const buildAccountConditions = (account, vendorReport = false) => {
  const or = [];

  // 1️⃣ IP authentication
  if (account.authenticationType === 'ip' && account.authenticationValue) {
    // For vendor reports, check agentip; for customer reports, check callerip
    if (vendorReport) {
      or.push({ agentip: account.authenticationValue });
    } else {
      or.push({ callerip: account.authenticationValue });
    }
  }

  // 2️⃣ Custom authentication → search entire CDR row
  if (account.authenticationType === 'custom' && account.authenticationValue) {
    const v = `${account.authenticationValue}`;
    or.push(
      { customeraccount: { [Op.like]: v } },
      { agentaccount: { [Op.like]: v } },
      { callere164: { [Op.like]: v } },
      { calleee164: { [Op.like]: v } },
      { customername: { [Op.like]: v } },
      { agentname: { [Op.like]: v } }
    );
  }

  // 3️⃣ Gateway authentication (explicit)
  if (account.authenticationType === 'gateway' && account.authenticationValue) {
    or.push(
      vendorReport
        ? { agentaccount: account.authenticationValue }
        : { customeraccount: account.authenticationValue }
    );
  }

  // 4️⃣ Fallback to gatewayId only if authenticationValue is not set but type is gateway
  if (or.length === 0 && account.gatewayId) {
    or.push(
      vendorReport
        ? { agentaccount: account.gatewayId }
        : { customeraccount: account.gatewayId }
    );
  }

  return or;
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
      dueInDays = 7,
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
    const isNumeric = /^\d+$/.test(customerId);
    const customerWhere = {
      [Op.or]: [
        { gatewayId: customerId },
        { customerCode: customerId }
      ]
    };
    if (isNumeric) customerWhere[Op.or].push({ accountId: customerId });

    const customer = await Account.findOne({
      where: customerWhere
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }

    // Get country codes for mapping
    const countryCodes = await CountryCode.findAll({ raw: true });

    // ✅ Build CDR WHERE conditions using authentication logic
    const authConditions = buildAccountConditions(customer, false); // false = customer report
    
    if (authConditions.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Unable to build authentication conditions for this customer'
      });
    }

    const cdrWhere = {
      starttime: {
        [Op.between]: [formatTime(billingPeriodStart), formatTime(billingPeriodEnd, 23, true)]
      },
      [Op.or]: authConditions
    };

    // Fetch CDR data for the billing period using authentication conditions
    const cdrs = await CDR.findAll({
      attributes: [
        'customeraccount',
        'customername',
        'callere164',
        'calleee164',
        [fn('COUNT', col('*')), 'totalCalls'],
        [fn('SUM', H.completedCall), 'completedCalls'],
        [fn('SUM', H.failedCall), 'failedCalls'],
        [fn('SUM', H.durationSec), 'duration'],
        [fn('SUM', H.revenue), 'revenue']
      ],
      where: cdrWhere,
      group: ['customeraccount', 'customername', 'callere164', 'calleee164'],
      raw: true
    });

    if (cdrs.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No CDR records found for this customer in the billing period'
      });
    }

    // Group CDRs by destination country, prefix and trunk
    const groupedData = {};
    cdrs.forEach(cdr => {
      let destination = 'Unknown';
      let prefix = '';
      
      const phoneNumber = parsePhoneNumberFromString('+' + cdr.callere164.toString().replace(/^\+/, ''));
      
      if (phoneNumber) {
        destination = getCountryFromNumber(cdr.callere164, countryCodes, false);
        // Prefix is Country Code + part of national number to represent area
        prefix = phoneNumber.countryCallingCode;
        
        // If we have a national number, the first 2-3 digits usually represent the area/network
        const national = phoneNumber.nationalNumber;
        if (national.length > 3) {
          prefix += national.substring(0, 3);
        }
      } else {
        // Fallback to existing logic if libphonenumber fails
        destination = getCountryFromNumber(cdr.callere164, countryCodes, false);
        prefix = cdr.callere164 ? cdr.callere164.toString().substring(0, 5) : '';
      }

      const trunk = getTrunkName(cdr.calleee164);
      const key = `${destination}|${prefix}|${trunk}`;
      
      if (!groupedData[key]) {
        groupedData[key] = {
          destination,
          trunk,
          prefix,
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

    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber();
    const invoiceDate = Date.now();
    const dueDate = (Date.now() + (dueInDays * 24 * 60 * 60 * 1000));

    // Calculate subtotal
    let subtotal = 0;
    const invoiceItems = Object.values(groupedData)
      .filter(item => item.completedCalls > 0)
      .map((item, index) => {
      
      const durationMinutes = (item.duration / 60).toFixed(2);
      const amount = Number(item.revenue);
      subtotal += amount;

      return {
        itemType: 'call_charges',
        description: `Calls to ${item.destination} (${item.trunk})`,
        destination: item.destination,
        trunk: item.trunk,
        prefix: item.prefix,
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
        periodStart: formatTime(billingPeriodStart),
        periodEnd: formatTime(billingPeriodEnd, 23, true),
        sortOrder: index
      };
    });

    if (invoiceItems.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No successful calls found for this customer in the billing period'
      });
    }

    // Calculate tax and total
    const taxAmount = (subtotal * (taxRate / 100));
    const totalAmount = subtotal + taxAmount - discountAmount;

    // Create invoice
    const customerGatewayId = (customer.authenticationType === 'gateway' && customer.authenticationValue) 
      ? customer.authenticationValue 
      : customer.gatewayId;

    const invoice = await Invoice.create({
      invoiceNumber,
      customerGatewayId,
      customerName: customer.accountName,
      customerCode: customer.customerCode,
      customerEmail: customer.email,
      customerAddress: customer.address,
      customerPhone: customer.phone,
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
      const isNumeric = /^\d+$/.test(customerId);
      const customerWhere = {
        [Op.or]: [
          { gatewayId: customerId },
          { customerCode: customerId }
        ]
      };
      
      // Only add accountId to search if customerId is numeric
      if (isNumeric) {
        customerWhere[Op.or].push({ accountId: customerId });
      }

      const customer = await Account.findOne({
        where: customerWhere
      });
      if (customer) {
        where.customerCode = customer.customerCode;
      }
    }

    if (status) {
      where.status = status;
    }

    if (startDate && endDate) {
      where.invoiceDate = {
        [Op.between]: [formatTime(startDate), formatTime(endDate, 23, true)]
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

    // Use specific where clause to avoid casting error if id is not numeric
    const isNumeric = /^\d+$/.test(id);
    const whereClause = isNumeric 
      ? { [Op.or]: [{ id: parseInt(id) }, { invoiceNumber: id }] }
      : { invoiceNumber: id };

    const invoice = await Invoice.findOne({
      where: whereClause,
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
    const isNumeric = /^\d+$/.test(id);
    if (!isNumeric) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found'
      });
    }

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

    // Convert dates to timestamps if present
    if (updateData.invoiceDate) updateData.invoiceDate = formatTime(updateData.invoiceDate);
    if (updateData.dueDate) updateData.dueDate = formatTime(updateData.dueDate);
    if (updateData.billingPeriodStart) updateData.billingPeriodStart = formatTime(updateData.billingPeriodStart);
    if (updateData.billingPeriodEnd) updateData.billingPeriodEnd = formatTime(updateData.billingPeriodEnd, 23, true);
    if (updateData.paymentDate) updateData.paymentDate = formatTime(updateData.paymentDate);

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
    const isNumeric = /^\d+$/.test(id);
    if (!isNumeric) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found'
      });
    }

    const invoice = await Invoice.findByPk(id);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found'
      });
    }

    // Only allow deletion of draft or cancelled invoices
    if (!['draft','pending', 'cancelled', 'void'].includes(invoice.status)) {
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
      invoiceId,
      invoiceAllocations = [] // Array of { invoiceId, amount }
    } = req.body;

    // Handle single invoiceId if provided
    let allocations = [...invoiceAllocations];
    if (invoiceId && allocations.length === 0) {
      allocations.push({ invoiceId, amount });
    }

    // Validate
    if (!customerId || !amount || !paymentDate || !paymentMethod) {
      return res.status(400).json({
        success: false,
        error: 'customerId, amount, paymentDate, and paymentMethod are required'
      });
    }

    // Get customer by customerCode or other IDs
    const customer = await Account.findOne({
      where: {
        [Op.or]: [
          { customerCode: customerId },
          { gatewayId: customerId },
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
    if (allocations.length > 0) {
      totalAllocated = allocations.reduce((sum, alloc) => sum + Number(alloc.amount), 0);
    }

    if (totalAllocated > amount) {
      return res.status(400).json({
        success: false,
        error: 'Total allocated amount cannot exceed payment amount'
      });
    }

    // Create payment using customerCode
    const payment = await Payment.create({
      paymentNumber,
      receiptNumber,
      customerGatewayId: customer.gatewayId,
      customerCode: customer.customerCode,
      customerName: customer.accountName,
      amount: parseFloat(amount),
      paymentDate: formatTime(paymentDate),
      paymentMethod,
      transactionId,
      referenceNumber,
      status: 'completed',
      allocatedAmount: parseFloat(totalAllocated),
      unappliedAmount: parseFloat(amount - totalAllocated),
      notes,
      recordedBy: req.user?.id || null,
      recordedDate: Date.now()
    }, { transaction });

    // Create allocations and update invoices
    for (const allocation of allocations) {
      const invoice = await Invoice.findByPk(allocation.invoiceId, { transaction });
      
      if (!invoice) {
        throw new Error(`Invoice ${allocation.invoiceId} not found`);
      }

      // Verify invoice belongs to this customer using customerCode
      if (invoice.customerCode !== customer.customerCode) {
        throw new Error(`Invoice ${allocation.invoiceId} does not belong to customer ${customer.customerCode}`);
      }

      // Create allocation
      await PaymentAllocation.create({
        paymentId: payment.id,
        invoiceId: allocation.invoiceId,
        allocatedAmount: parseFloat(allocation.amount),
        allocationDate: formatTime(paymentDate),
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
        paymentDate: newStatus === 'paid' ? formatTime(paymentDate) : invoice.paymentDate
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


/* ===================== GET ALL PAYMENTS ===================== */
exports.getAllPayments = async (req, res) => {
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
      const isNumeric = /^\d+$/.test(customerId);
      const customerWhere = {
        [Op.or]: [
          { gatewayId: customerId },
          { customerCode: customerId }
        ]
      };
      
      // Only add accountId to search if customerId is numeric
      if (isNumeric) {
        customerWhere[Op.or].push({ accountId: customerId });
      }

      const customer = await Account.findOne({
        where: customerWhere
      });
      if (customer) {
        where.customerCode = customer.customerCode;
      }
    }

    if (status) {
      where.status = status;
    }

    if (startDate && endDate) {
      where.paymentDate = {
        [Op.between]: [formatTime(startDate), formatTime(endDate, 23, true)]
      };
    }

    const offset = (page - 1) * limit;

    const { count, rows } = await Payment.findAndCountAll({
      where,
      include: [{
        model: PaymentAllocation,
        as: 'allocations',
        include: [{
          model: Invoice,
          as: 'invoice',
          attributes: ['invoiceNumber', 'totalAmount', 'balanceAmount']
        }]
      }],
      order: [['paymentDate', 'DESC']],
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
    console.error('Get All Payments Error:', error);
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
    const isNumeric = /^\d+$/.test(customerId);
    const customerWhere = {
      [Op.or]: [
        { gatewayId: customerId },
        { customerCode: customerId }
      ]
    };
    if (isNumeric) customerWhere[Op.or].push({ accountId: customerId });

    const customer = await Account.findOne({
      where: customerWhere
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

/* ===================== GET LITE INVOICES (FOR DROPDOWNS) ===================== */
exports.getLiteInvoices = async (req, res) => {
  try {
    const { customerId, status } = req.query;
    const where = {};

    if (customerId) {
      where.customerCode = customerId;
    }

    if (status) {
      where.status = status;
    }

    const invoices = await Invoice.findAll({
      where,
      attributes: ['id', 'invoiceNumber', 'customerName', 'customerCode', 'status', 'totalAmount', 'balanceAmount', 'invoiceDate', 'dueDate'],
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: invoices
    });
  } catch (error) {
    console.error('Get Lite Invoices Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

module.exports = exports;