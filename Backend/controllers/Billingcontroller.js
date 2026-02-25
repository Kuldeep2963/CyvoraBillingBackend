const { Op, fn, col } = require('sequelize');
const { parsePhoneNumberFromString } = require('libphonenumber-js');
const puppeteer = require('puppeteer');
const moment = require('moment');
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

  // ✅ FIX (Bug 2): Determine auth type and value independently for vendor vs customer.
  // Previously, vendor auth fell back to customerauthenticationType, which caused
  // vendor CDR queries to use customer-side fields (callerip, customeraccount),
  // resulting in zero matching CDR rows for the vendor.
  let authType, authValue;

  if (vendorReport) {
    // For vendors: ONLY use vendor auth fields, do NOT fall back to customer fields
    authType = account.vendorauthenticationType;
    authValue = account.vendorauthenticationValue;
  } else {
    // For customers: use customer auth fields only
    authType = account.customerauthenticationType;
    authValue = account.customerauthenticationValue;
  }

  // 1️⃣ IP authentication
  if (authType === 'ip' && authValue) {
    if (vendorReport) {
      // For vendor reports, we check calleeip (where we send calls to the vendor)
      or.push({ calleeip: authValue });
    } else {
      // For customer reports, we check callerip (where calls come from)
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
        'calleegatewayid',
        [fn('COUNT', col('*')), 'totalCalls'],
        [fn('SUM', H.completedCall), 'completedCalls'],
        [fn('SUM', H.failedCall), 'failedCalls'],
        [fn('SUM', H.durationSec), 'duration'],
        [fn('SUM', H.revenue), 'revenue']
      ],
      where: cdrWhere,
      group: ['customeraccount', 'customername', 'callere164', 'calleee164', 'calleegatewayid'],
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
      
      // Clean calleee164 and remove 5-digit trunk prefix
      const fullCalleee = cdr.calleee164 ? cdr.calleee164.toString().replace(/^\+/, '') : '';
      const actualCalleee = fullCalleee.length > 5 ? fullCalleee.substring(5) : fullCalleee;
      
      const phoneNumber = parsePhoneNumberFromString('+' + actualCalleee);
      
      if (phoneNumber) {
        destination = getCountryFromNumber(actualCalleee, countryCodes);
        prefix = phoneNumber.countryCallingCode;
        
        const national = phoneNumber.nationalNumber;
        
        if (!destination) {
          console.warn('Failed to detect country for:', actualCalleee, phoneNumber);
        }
      } else {
        console.warn('libphonenumber parsing failed for:', actualCalleee);
        destination = getCountryFromNumber(actualCalleee, countryCodes);
        
        if (actualCalleee.length >= 6) {
          prefix = actualCalleee.substring(0, 3);
        } else {
          prefix = actualCalleee;
        }
      }

      const trunk = getTrunkName(cdr.calleee164);
      
      // Extract custom description from calleegatewayid (after second --)
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

    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber();
    const invoiceDate = Date.now();
    const dueDate = (Date.now() + (dueInDays * 24 * 60 * 60 * 1000));

    // Calculate subtotal
    let subtotal = 0;
    let totalCallsCount = 0;
    const invoiceItems = Object.values(groupedData)
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
    const customerGatewayId = (customer.customerauthenticationType === 'gateway' && customer.customerauthenticationValue) 
      ? customer.customerauthenticationValue 
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
      totalCalls: totalCallsCount,
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
      where: whereClause
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

/* ===================== GET INVOICE ITEMS ===================== */
exports.getInvoiceItems = async (req, res) => {
  try {
    const { id } = req.params;
    
    const items = await InvoiceItem.findAll({
      where: { invoiceId: id },
      order: [['sortOrder', 'ASC']]
    });

    res.json({
      success: true,
      items
    });

  } catch (error) {
    console.error('Get Invoice Items Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/* ===================== DOWNLOAD INVOICE PDF ===================== */
exports.downloadInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find invoice with items
    const invoice = await Invoice.findByPk(id, {
      include: [{
        model: InvoiceItem,
        as: 'items'
      }]
    });

    if (!invoice) {
      // Also try to find by invoice number if id is not numeric
      const isNumeric = /^\d+$/.test(id);
      if (!isNumeric) {
        const invoiceByNum = await Invoice.findOne({
          where: { invoiceNumber: id },
          include: [{
            model: InvoiceItem,
            as: 'items'
          }]
        });
        if (invoiceByNum) return exports.generatePdf(invoiceByNum, res);
      }
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    return exports.generatePdf(invoice, res);

  } catch (error) {
    console.error('Download Invoice Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/* ===================== HELPER: GENERATE PDF ===================== */
exports.generatePdf = async (invoice, res) => {
  let browser;
  try {
    const invoiceData = invoice.toJSON();
    
    // Format dates for the template
    const formattedInvoiceDate = moment(parseInt(invoiceData.invoiceDate)).format("DD-MM-YYYY");
    const formattedDueDate = moment(parseInt(invoiceData.dueDate)).format("DD-MM-YYYY");
    const formattedPeriodStart = moment(parseInt(invoiceData.billingPeriodStart)).format("DD MMM");
    const formattedPeriodEnd = moment(parseInt(invoiceData.billingPeriodEnd)).format("DD MMM YYYY");

    const invoiceHtml = `
      <html>
        <head>
          <title>Invoice ${invoiceData.invoiceNumber}</title>
          <style>
            body { 
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
              margin: 0; 
              padding: 0;
              color: #333;
              background-color: #fff;
            }
            .invoice-container {
              padding: 40px;
              max-width: 800px;
              margin: 0 auto;
            }
            .invoice-header {
              display: flex;
              justify-content: space-between;
              margin-bottom: 40px;
              border-bottom: 3px solid #1a365d;
              padding-bottom: 20px;
            }
            .company-logo {
              height: 40px;
              width: auto;
              display: block;
              object-fit: contain;
            }
            .invoice-title {
              font-size: 32px;
              font-weight: bold;
              color: #2d3748;
              text-align: right;
            }
            .address-section {
              display: flex;
              justify-content: space-between;
              margin-bottom: 40px;
            }
            .address-box {
              width: 45%;
            }
            .address-label {
              font-weight: bold;
              color: #4a5568;
              text-transform: uppercase;
              font-size: 12px;
              margin-bottom: 8px;
              border-bottom: 1px solid #e2e8f0;
              padding-bottom: 4px;
            }
            .address-content {
              font-size: 14px;
              line-height: 1.6;
            }
            .details-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 20px;
              background-color: #f7fafc;
              padding: 20px;
              border-radius: 8px;
              margin-bottom: 40px;
              border: 1px solid #e2e8f0;
            }
            .detail-item {
              display: flex;
              flex-direction: column;
            }
            .detail-label {
              font-size: 11px;
              color: #718096;
              text-transform: uppercase;
              font-weight: bold;
            }
            .detail-value {
              font-size: 14px;
              color: #2d3748;
              font-weight: 600;
            }
            .table-section {
              margin-bottom: 40px;
            }
            .invoice-table {
              width: 100%;
              border-collapse: collapse;
              font-size: 12px;
            }
            .invoice-table th {
              background-color: #1a365d;
              color: white;
              text-align: left;
              padding: 12px 8px;
              text-transform: uppercase;
              font-weight: 600;
            }
            .invoice-table td {
              padding: 10px 8px;
              border-bottom: 1px solid #e2e8f0;
            }
            .invoice-table tr:nth-child(even) {
              background-color: #f8fafc;
            }
            .text-right { text-align: right; }
            .totals-section {
              display: flex;
              justify-content: flex-end;
              margin-bottom: 40px;
            }
            .totals-box {
              width: 250px;
            }
            .total-row {
              display: flex;
              justify-content: space-between;
              padding: 8px 0;
              font-size: 14px;
            }
            .total-grand {
              border-top: 2px solid #1a365d;
              margin-top: 8px;
              padding-top: 12px;
              font-weight: bold;
              font-size: 18px;
              color: #1a365d;
            }
            .bank-section {
              background-color: #f8fafc;
              padding: 20px;
              border-radius: 8px;
              border-left: 4px solid #1a365d;
              font-size: 12px;
            }
            .bank-title {
              font-weight: bold;
              margin-bottom: 10px;
              color: #1a365d;
              text-transform: uppercase;
            }
            .footer {
              margin-top: 60px;
              text-align: center;
              font-size: 11px;
              color: #a0aec0;
              border-top: 1px solid #e2e8f0;
              padding-top: 20px;
            }
          </style>
        </head>
        <body>
          <div class="invoice-container">
            <div class="invoice-header">
              <div>
                <h2 style="color: #1a365d; margin: 0;">PAI TELECOMM</h2>
              </div>
              <div class="invoice-title">INVOICE</div>
            </div>

            <div class="address-section">
              <div class="address-box">
                <div class="address-label">From</div>
                <div class="address-content">
                  <strong>Pai Telecomm Private Limited</strong><br>
                  810, 8th floor, vipul bussiness park<br>
                  sector-46, Gurgaon<br>
                  122018<br>
                  Email: accounts@paitelecomm.com
                </div>
              </div>
              <div class="address-box">
                <div class="address-label">Bill To</div>
                <div class="address-content">
                  <strong>${invoiceData.customerName || "Customer"}</strong><br>
                  ${invoiceData.customerAddress || ""}<br>
                  ${invoiceData.customerEmail || ""}<br>
                  ${invoiceData.customerPhone || ""}
                </div>
              </div>
            </div>

            <div class="details-grid">
              <div class="detail-item">
                <span class="detail-label">Invoice Number</span>
                <span class="detail-value">${invoiceData.invoiceNumber}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Invoice Date</span>
                <span class="detail-value">${formattedInvoiceDate}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Due Date</span>
                <span class="detail-value">${formattedDueDate}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Billing Period</span>
                <span class="detail-value">${formattedPeriodStart} - ${formattedPeriodEnd}</span>
              </div>
            </div>

            <div class="table-section">
              <table class="invoice-table">
                <thead>
                  <tr>
                    <th>Trunk</th>
                    <th>Prefix</th>
                    <th>Destination</th>
                    <th>Description</th>
                    <th class="text-right">Calls</th>
                    <th class="text-right">Duration (Min)</th>
                    <th class="text-right">Rate</th>
                    <th class="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${invoiceData.items
                    ?.map(
                      (item) => `
                    <tr>
                      <td>${item.trunk || "-"}</td>
                      <td>${item.prefix || "-"}</td>
                      <td>${item.destination || "-"}</td>
                      <td>${item.description || "-"}</td>
                      <td class="text-right">${item.totalCalls}</td>
                      <td class="text-right">${(item.duration / 60).toFixed(2)}</td>
                      <td class="text-right">$${parseFloat(item.unitPrice).toFixed(4)}</td>
                      <td class="text-right">$${parseFloat(item.amount).toFixed(4)}</td>
                    </tr>
                  `,
                    )
                    .join("")}
                </tbody>
              </table>
            </div>

            <div class="totals-section">
              <div class="totals-box">
                <div class="total-row">
                  <span>Subtotal</span>
                  <span>$${parseFloat(invoiceData.subtotal).toFixed(4)}</span>
                </div>
                <div class="total-row">
                  <span>Tax (${invoiceData.taxRate}%)</span>
                  <span>$${parseFloat(invoiceData.taxAmount).toFixed(4)}</span>
                </div>
                <div class="total-row">
                  <span>Discount</span>
                  <span>-$${parseFloat(invoiceData.discountAmount || 0).toFixed(4)}</span>
                </div>
                <div class="total-row total-grand">
                  <span>Total Amount</span>
                  <span>$${parseFloat(invoiceData.totalAmount).toFixed(4)}</span>
                </div>
              </div>
            </div>

            <div class="bank-section">
              <div class="bank-title">Payment Information</div>
              <strong>Bank Name:</strong> Bank Of China<br>
              <strong>Account Name:</strong> Pai Telecommunications Limited<br>
              <strong>Account Number:</strong> 012-687-2-011894-5 (USD)<br>
              <strong>Swift Code:</strong> BKCHHKHHXXX<br>
              <strong>Bank Address:</strong> Bank of China Tower, 1 Garden Road, Central, Hong Kong
            </div>

            <div class="footer">
              Thank you for your business. Please contact accounts@paitelecomm.com for any billing inquiries.<br>
              Generated by CDR Billing System
            </div>
          </div>
        </body>
      </html>
    `;

    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage();
    await page.setContent(invoiceHtml, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px'
      }
    });

    await browser.close();

    res.contentType("application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=Invoice_${invoiceData.invoiceNumber}.pdf`);
    res.send(pdf);

  } catch (error) {
    if (browser) await browser.close();
    console.error('PDF Generation Error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate PDF' });
  }
};

/* ===================== UPDATE INVOICE ===================== */
exports.updateInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
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
    const { customerId, status, startDate, endDate } = req.query;
    const where = {};

    if (customerId) {
      where.customerCode = customerId;
    }

    if (status) {
      where.status = status;
    }

    if (startDate && endDate) {
      where.billingPeriodStart = { [Op.gte]: formatTime(startDate) };
      where.billingPeriodEnd = { [Op.lte]: formatTime(endDate, 23, true) };
    } else if (startDate) {
      where.billingPeriodStart = { [Op.gte]: formatTime(startDate) };
    } else if (endDate) {
      where.billingPeriodEnd = { [Op.lte]: formatTime(endDate, 23, true) };
    }

    const invoices = await Invoice.findAll({
      where,
      attributes: ['id', 'invoiceNumber', 'customerName', 'customerCode', 'status', 'totalAmount', 'balanceAmount', 'invoiceDate', 'dueDate','billingPeriodStart', 'billingPeriodEnd'],
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

/* ===================== GET VENDOR USAGE FOR PERIODS ===================== */
exports.getVendorUsage = async (req, res) => {
  try {
    const { vendorCode, periods } = req.body;

    if (!vendorCode || !periods || !Array.isArray(periods)) {
      return res.status(400).json({ success: false, error: 'vendorCode and periods (array) are required' });
    }

    // ✅ FIX (Bug 3): Also search by accountId (consistent with customer lookup)
    const isNumeric = /^\d+$/.test(vendorCode);
    const vendorWhere = {
      [Op.or]: [
        { gatewayId: vendorCode },
        { vendorCode: vendorCode }
      ]
    };
    if (isNumeric) vendorWhere[Op.or].push({ accountId: vendorCode });

    const vendor = await Account.findOne({ where: vendorWhere });
    if (!vendor) return res.status(404).json({ success: false, error: 'Vendor not found' });

    // ✅ FIX (Bug 2): buildAccountConditions now correctly uses vendorauthenticationType only
    const authConditions = buildAccountConditions(vendor, true);

    // 🛡️ Extra safety: log what conditions were built for debugging
    console.log('[getVendorUsage] Auth conditions for vendor', vendorCode, ':', JSON.stringify(authConditions));

    if (authConditions.length === 0) {
      return res.status(400).json({ success: false, error: 'Unable to build authentication conditions for this vendor' });
    }

    const results = [];
    for (const period of periods) {
      const { startDate, endDate } = period;
      const cdrWhere = {
        starttime: { [Op.between]: [formatTime(startDate), formatTime(endDate, 23, true)] },
        [Op.or]: authConditions
      };

      // ✅ FIX (Bug 1): Use H.cost for vendor (what we owe the vendor), NOT H.revenue
      // H.revenue = what customer pays us (our income)
      // H.cost    = what we pay the vendor (our expense / vendor's receivable)
      // Both must be defined in reportHelper.js pointing to correct CDR columns.
      const usage = await CDR.findOne({
        attributes: [
          [fn('COUNT', col('*')), 'totalCalls'],
          [fn('SUM', H.completedCall), 'completedCalls'],
          [fn('SUM', H.durationSec), 'duration'],
          // ✅ Use H.cost — the amount we owe the vendor per CDR row
          // If H.cost is still returning null/0, verify that reportHelper.js
          // maps H.cost to the correct CDR column (e.g., 'agentcost', 'vendorcost', 'cost', etc.)
          [fn('SUM', H.cost), 'totalAmount']
        ],
        where: cdrWhere,
        raw: true
      });

      // ✅ FIX: Safely parse values — SUM of NULL rows returns null, not 0
      const totalCalls = parseInt(usage?.totalCalls || 0);
      const completedCalls = parseInt(usage?.completedCalls || 0);
      const duration = parseFloat(usage?.duration || 0);
      const totalAmount = parseFloat(usage?.totalAmount || 0); // null-safe

      results.push({
        id: `usage_${startDate}_${endDate}`,
        invoiceNumber: 'USAGE-ONLY',
        invoiceDate: Date.now(),
        billingPeriodStart: formatTime(startDate),
        billingPeriodEnd: formatTime(endDate, 23, true),
        dueDate: Date.now(),
        totalAmount,
        balanceAmount: totalAmount,
        totalCalls,
        completedCalls,
        duration,
        status: 'unpaid'
      });
    }

    console.log('[getVendorUsage] Results:', results);
    res.json({ success: true, data: results });

  } catch (error) {
    console.error('Error fetching vendor usage:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch vendor usage' });
  }
};

module.exports = exports;