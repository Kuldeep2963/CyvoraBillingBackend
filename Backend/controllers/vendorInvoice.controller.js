const { Op, fn, col, ValidationError, UniqueConstraintError } = require('sequelize');
const VendorInvoice = require('../models/Vendorinvoice');
const Account = require('../models/Account');
const Payment = require('../models/Payment');
const CDR = require('../models/CDR');
const sequelize = require('../config/database');
const path = require('path');
const fs = require('fs');
const { normalizeStoredPath, toStoredRelativePath } = require('../config/storage');
const H = require('../utils/reportHelper');
const EmailService = require('../services/EmailService');
const BillingAutomationService = require('../services/BillingAutomationService');

const parseStoredFilePaths = (rawValue) => {
  if (!rawValue) return [];

  if (Array.isArray(rawValue)) {
    return rawValue
      .map((item) => (item == null ? '' : String(item).trim()))
      .filter(Boolean);
  }

  if (typeof rawValue === 'string') {
    try {
      const parsed = JSON.parse(rawValue);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => (item == null ? '' : String(item).trim()))
          .filter(Boolean);
      }
    } catch (_error) {
      // Fall through to plain string parsing.
    }

    return rawValue
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
};

const getFileExtCategory = (ext) => {
  const lower = String(ext || '').toLowerCase();
  if (['.pdf'].includes(lower)) return 'pdf';
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(lower)) return 'image';
  if (['.xls', '.xlsx', '.csv'].includes(lower)) return 'spreadsheet';
  return 'file';
};

const removeFileSafe = async (storedPathOrAbsolutePath) => {
  const resolvedPath = normalizeStoredPath(storedPathOrAbsolutePath);
  if (!resolvedPath) return;

  try {
    await fs.promises.unlink(resolvedPath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn('Failed to remove vendor invoice file:', resolvedPath, error.message);
    }
  }
};

const cleanupUploadedFiles = async (files) => {
  const filePaths = Array.isArray(files) ? files.map((file) => file?.path).filter(Boolean) : [];
  await Promise.allSettled(filePaths.map((filePath) => removeFileSafe(filePath)));
};

const addDaysAsDateOnly = (dateValue, days) => {
  if (!dateValue && dateValue !== 0) return null;

  const numericDate = Number(dateValue);
  const baseDate = !isNaN(numericDate) ? new Date(numericDate) : new Date(dateValue);
  if (isNaN(baseDate.getTime())) return null;

  baseDate.setDate(baseDate.getDate() + days);
  return baseDate.toISOString().split('T')[0];
};

const buildVendorBillingUpdates = (account, billedThroughDate) => {
  return BillingAutomationService.buildStreamUpdates(
    account,
    'vendor',
    billedThroughDate,
  );
};

const getBillingDateSnapshot = (account) => {
  if (!account) return null;

  const data = account.toJSON ? account.toJSON() : account;
  return {
    accountId: data.id,
    accountCode: data.vendorCode || data.customerCode || data.gatewayId || null,
    accountRole: data.accountRole || null,
    customerLastBillingDate: data.customerLastBillingDate || null,
    customerNextBillingDate: data.customerNextBillingDate || null,
    vendorLastBillingDate: data.vendorLastBillingDate || null,
    vendorNextBillingDate: data.vendorNextBillingDate || null,
    lastbillingdate: data.lastbillingdate || null,
    nextbillingdate: data.nextbillingdate || null,
  };
};

const recalculateVendorBillingDatesAfterDelete = async (account, deletedInvoice, transaction) => {
  if (!account) return;

  const latestRemainingInvoice = await VendorInvoice.findOne({
    where: { vendorCode: account.vendorCode },
    order: [["endDate", "DESC"], ["createdAt", "DESC"]],
    transaction,
  });

  const deletedInvoiceStartDate = deletedInvoice?.startDate
    ? addDaysAsDateOnly(deletedInvoice.startDate, 0)
    : null;
  const fallbackDate = deletedInvoiceStartDate || addDaysAsDateOnly(account.billingStartDate || account.createdAt, 0);
  const billedThroughDate = latestRemainingInvoice?.endDate
    ? addDaysAsDateOnly(latestRemainingInvoice.endDate, 1)
    : fallbackDate;

  if (!billedThroughDate) return;

  const updates = BillingAutomationService.buildStreamUpdates(
    account,
    "vendor",
    billedThroughDate,
  );

  await account.update(updates, { transaction });
};

const parsePaymentDate = (value) => {
  if (!value) return Date.now();

  const numericDate = Number(value);
  const date = !isNaN(numericDate) ? new Date(numericDate) : new Date(value);
  if (isNaN(date.getTime())) return Date.now();
  return date.getTime();
};

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
    sequence = parseInt(lastNumber, 10) + 1;
  }

  return `PAY-${year}-${month}-${String(sequence).padStart(4, '0')}`;
};

/**
 * Helper: Fetch vendor usage from CDRs for a given billing period
 * Returns the total cost for the vendor in the specified period
 */
const fetchVendorUsage = async (account, startDate, endDate) => {
  try {
    // Build vendor authentication conditions
    const vendorAuthType = account.vendorauthenticationType;
    const vendorAuthValue = account.vendorauthenticationValue;
    
    const normalizeAuthValues = (value) => {
      if (Array.isArray(value)) {
        return [...new Set(value.map((v) => String(v || "").trim()).filter(Boolean))];
      }
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) return [];
        if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
          try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) {
              return [...new Set(parsed.map((v) => String(v || "").trim()).filter(Boolean))];
            }
          } catch (_error) {}
        }
        return [...new Set(trimmed.split(",").map((v) => v.trim()).filter(Boolean))];
      }
      if (value == null) return [];
      const single = String(value).trim();
      return single ? [single] : [];
    };

    const authValues = normalizeAuthValues(vendorAuthValue);
    const authConditions = [];

    if (vendorAuthType === "ip" && authValues.length > 0) {
      authValues.forEach((value) => {
        authConditions.push({ calleeip: value });
      });
    }

    if (vendorAuthType === "custom" && authValues.length > 0) {
      authValues.forEach((value) => {
        const v = `${value}`;
        authConditions.push({ agentaccount: { [Op.like]: v } });
        authConditions.push({ agentname: { [Op.like]: v } });
      });
    }

    if (authConditions.length === 0) {
      const vCode = account.vendorCode || account.gatewayId;
      if (vCode) authConditions.push({ agentaccount: vCode });
    }

    const formatTime = (date, hour = 0, isEnd = false) => {
      if (!date) return null;
      const numericDate = Number(date);
      const d = !isNaN(numericDate) ? new Date(numericDate) : new Date(date);
      if (isNaN(d.getTime())) return null;
      d.setHours(hour, isEnd ? 59 : 0, isEnd ? 59 : 0, isEnd ? 999 : 0);
      return d.getTime().toString();
    };

    const cdrWhere = {
      starttime: {
        [Op.between]: [
          formatTime(startDate),
          formatTime(endDate, 23, true),
        ],
      },
      [Op.or]: authConditions,
    };

    const cdrs = await CDR.findAll({
      attributes: [
        [fn("SUM", H.cost), "totalCost"],
        [fn("COUNT", col("*")), "totalCalls"],
        [fn("SUM", H.completedCall), "completedCalls"],
      ],
      where: cdrWhere,
      raw: true,
    });

    const totalCost = cdrs.length > 0 && cdrs[0].totalCost ? Number(cdrs[0].totalCost) : 0;
    const totalCalls = cdrs.length > 0 && cdrs[0].totalCalls ? Number(cdrs[0].totalCalls) : 0;
    const completedCalls = cdrs.length > 0 && cdrs[0].completedCalls ? Number(cdrs[0].completedCalls) : 0;

    return {
      totalCost: parseFloat(totalCost.toFixed(4)),
      totalCalls,
      completedCalls,
      failedCalls: totalCalls - completedCalls,
    };
  } catch (error) {
    console.error('Error fetching vendor usage:', error);
    return { totalCost: 0, totalCalls: 0, completedCalls: 0, failedCalls: 0 };
  }
};

const resolveVendorAccount = async ({ vendorId, vendorCode }, transaction = null) => {
  if (vendorId) {
    return Account.findByPk(vendorId, transaction ? { transaction } : undefined);
  }
  if (vendorCode) {
    return Account.findOne({ where: { vendorCode }, ...(transaction ? { transaction } : {}) });
  }
  return null;
};

const buildUsageComparison = (invoiceAmount, usageCost, tolerance = 0.01) => {
  const uploadedAmount = Number(invoiceAmount || 0);
  const actualAmount = Number(usageCost || 0);
  const delta = uploadedAmount - actualAmount;
  const mismatchAmount = Math.abs(delta);
  const percentageDiffRaw = uploadedAmount > 0 ? (mismatchAmount / uploadedAmount) * 100 : 0;
  // Any non-zero mismatch should present dispute action choices to the user.
  const mismatchDetected = mismatchAmount > 0;
  const mismatchDirection = delta > 0 ? 'overbilled' : (delta < 0 ? 'underbilled' : 'matched');
  const canRaiseDispute = mismatchDirection === 'overbilled';
  const exceedsTolerance = uploadedAmount > 0
    ? (mismatchAmount / uploadedAmount) > tolerance
    : mismatchAmount > 0;

  return {
    uploadedAmount: parseFloat(uploadedAmount.toFixed(4)),
    actualUsage: parseFloat(actualAmount.toFixed(4)),
    mismatchAmount: parseFloat(mismatchAmount.toFixed(4)),
    percentageDiff: `${percentageDiffRaw.toFixed(2)}%`,
    mismatchDetected,
    mismatchDirection,
    canRaiseDispute,
    exceedsTolerance,
    rows: [
      {
        label: 'Vendor Invoice Amount',
        value: parseFloat(uploadedAmount.toFixed(4)),
      },
      {
        label: 'Vendor Usage Amount',
        value: parseFloat(actualAmount.toFixed(4)),
      },
      {
        label: 'Difference',
        value: parseFloat(mismatchAmount.toFixed(4)),
      },
      {
        label: 'Difference %',
        value: `${percentageDiffRaw.toFixed(2)}%`,
      },
    ],
  };
};

exports.previewVendorUsage = async (req, res) => {
  try {
    const {
      vendorId,
      vendorCode,
      startDate,
      endDate,
      grandTotal,
    } = req.body || {};

    if ((!vendorId && !vendorCode) || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'vendorId or vendorCode, startDate and endDate are required',
      });
    }

    const account = await resolveVendorAccount({ vendorId, vendorCode });
    if (!account) {
      return res.status(404).json({ success: false, message: 'Vendor account not found' });
    }

    const actualUsage = await fetchVendorUsage(account, startDate, endDate);
    const usageComparison = buildUsageComparison(grandTotal, actualUsage.totalCost);

    return res.status(200).json({
      success: true,
      vendor: {
        id: account.id,
        vendorCode: account.vendorCode,
        accountName: account.accountName,
      },
      usage: actualUsage,
      usageComparison,
    });
  } catch (error) {
    console.error('Error previewing vendor usage:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to preview vendor usage',
      error: error.message,
    });
  }
};

exports.createVendorInvoice = async (req, res) => {
  const transaction = await sequelize.transaction();
  const uploadedFiles = Array.isArray(req.files) ? req.files : [];

  try {
    const {
      vendorId,
      vendorCode,
      invoiceNumber,
      issueDate,
      startDate,
      endDate,
      grandTotal,
      currency,
      totalSeconds,
      disputeAction,
    } = req.body;

    const normalizedInvoiceNumber = String(invoiceNumber || '').trim();
    const normalizedVendorCode = String(vendorCode || '').trim();
    const normalizedCurrency = String(currency || 'USD').trim() || 'USD';
    const normalizedIssueDate = String(issueDate || '').trim() || new Date().toISOString().split('T')[0];
    const normalizedStartDate = String(startDate || '').trim();
    const normalizedEndDate = String(endDate || '').trim();
    const normalizedGrandTotal = Number(grandTotal);
    const normalizedTotalSeconds = Number(totalSeconds);

    if (!normalizedInvoiceNumber || !normalizedIssueDate || !normalizedStartDate || !normalizedEndDate) {
      await transaction.rollback();
      return res.status(400).json({
        message: 'invoiceNumber, issueDate, startDate and endDate are required',
      });
    }

    if (Number.isNaN(normalizedGrandTotal) || Number.isNaN(normalizedTotalSeconds)) {
      await transaction.rollback();
      return res.status(400).json({
        message: 'grandTotal and totalSeconds must be valid numbers',
      });
    }

    const duplicateInvoice = await VendorInvoice.findOne({
      where: { invoiceNumber: normalizedInvoiceNumber },
      transaction,
    });

    if (duplicateInvoice) {
      await transaction.rollback();
      await cleanupUploadedFiles(uploadedFiles);
      return res.status(409).json({
        message: 'Invoice number already exists',
        field: 'invoiceNumber',
      });
    }

    let finalVendorId = vendorId;
    let finalVendorCode = vendorCode;
    const account = await resolveVendorAccount({ vendorId: finalVendorId, vendorCode: normalizedVendorCode || finalVendorCode }, transaction);

    if (!account) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Vendor account not found' });
    }

    finalVendorId = account.id;
    finalVendorCode = account.vendorCode;

    const duplicateBillingPeriodInvoice = await VendorInvoice.findOne({
      where: {
        vendorCode: finalVendorCode,
        startDate: normalizedStartDate,
        endDate: normalizedEndDate,
      },
      transaction,
    });

    if (duplicateBillingPeriodInvoice) {
      await transaction.rollback();
      await cleanupUploadedFiles(uploadedFiles);
      return res.status(409).json({
        message: 'A vendor invoice already exists for this billing period',
        field: 'startDate',
      });
    }

    const filePaths = uploadedFiles
      .map((file) => toStoredRelativePath(path.resolve(file.path)))
      .filter(Boolean);

    // Fetch actual vendor usage from CDRs for this billing period
    const actualUsage = await fetchVendorUsage(account, startDate, endDate);
    const usageComparison = buildUsageComparison(grandTotal, actualUsage.totalCost);

    if (usageComparison.mismatchDetected && usageComparison.canRaiseDispute && !['without_dispute', 'raise_dispute'].includes(String(disputeAction || '').trim())) {
      await transaction.rollback();
      await cleanupUploadedFiles(uploadedFiles);
      return res.status(409).json({
        success: false,
        message: 'Mismatch detected. Choose save without dispute or save and raise dispute.',
        requiresDisputeAction: true,
        usageComparison,
      });
    }

    const shouldRaiseDispute = usageComparison.mismatchDetected
      && usageComparison.canRaiseDispute
      && String(disputeAction).trim() === 'raise_dispute';

    const disputedPercentage = Number.parseFloat(String(usageComparison.percentageDiff || '0').replace('%', '')) || 0;
    const disputeDetails = shouldRaiseDispute
      ? {
        actualAmount: usageComparison.actualUsage,
        disputedAmount: usageComparison.mismatchAmount,
        disputedPercentage,
      }
      : null;

    const invoice = await VendorInvoice.create({
      vendorId: finalVendorId,
      vendorCode: finalVendorCode,
      invoiceNumber: normalizedInvoiceNumber,
      issueDate: normalizedIssueDate,
      startDate: normalizedStartDate,
      endDate: normalizedEndDate,
      grandTotal: normalizedGrandTotal,
      currency: normalizedCurrency,
      totalSeconds: normalizedTotalSeconds,
      filePaths: JSON.stringify(filePaths),
      status: shouldRaiseDispute ? 'disputed' : 'pending',
      disputeDetails,
    }, { transaction });

    const billedThroughDate = addDaysAsDateOnly(normalizedEndDate, 1);
    await account.update(buildVendorBillingUpdates(account, billedThroughDate), { transaction });

    await transaction.commit();

    let disputeEmailSent = false;
    if (shouldRaiseDispute) {
      try {
        await EmailService.sendDisputeRaisedNotification(
          {
            comment: `Vendor invoice mismatch detected. Uploaded amount: $${usageComparison.uploadedAmount.toFixed(4)}, Actual usage: $${usageComparison.actualUsage.toFixed(4)}, Difference: $${usageComparison.mismatchAmount.toFixed(4)} (${usageComparison.percentageDiff}).`,
            mismatchedCount: 1,
            invoiceNumber: invoice.invoiceNumber,
            disputeAmount: usageComparison.mismatchAmount,
            customerName: account.accountName,
          },
          account,
        );
        disputeEmailSent = true;
      } catch (mailError) {
        console.error('Failed to send dispute email for vendor invoice:', mailError);
      }
    }

    res.status(201).json({
      message: 'Vendor invoice created successfully',
      invoice,
      usageComparison: {
        ...usageComparison,
        disputeRaised: shouldRaiseDispute,
        disputeEmailSent,
      },
    });
  } catch (error) {
    if (transaction) await transaction.rollback();
    await cleanupUploadedFiles(uploadedFiles);
    console.error('Error creating vendor invoice:', error);

    if (error instanceof UniqueConstraintError) {
      return res.status(409).json({
        message: 'Invoice number already exists',
        error: error.errors?.[0]?.message || error.message,
      });
    }

    if (error instanceof ValidationError) {
      return res.status(400).json({
        message: 'Vendor invoice validation failed',
        error: error.errors?.map((item) => item.message).join(', ') || error.message,
      });
    }

    res.status(500).json({
      message: 'Failed to create vendor invoice',
      error: error.message
    });
  }
};

exports.getVendorInvoices = async (req, res) => {
  try {
    const { vendorCode, vendorId, startDate, endDate, search, vendorName, status, isDisputed } = req.query;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 10));
    const offset = (page - 1) * limit;
    const whereClause = {};

    if (vendorId) {
      whereClause.vendorId = vendorId;
    } else if (vendorCode) {
      whereClause.vendorCode = vendorCode;
    }

    if (startDate && endDate) {
      whereClause.startDate = { [Op.gte]: startDate };
      whereClause.endDate = { [Op.lte]: endDate };
    } else if (startDate) {
      whereClause.startDate = { [Op.gte]: startDate };
    } else if (endDate) {
      whereClause.endDate = { [Op.lte]: endDate };
    }

    if (status) {
      const normalizedStatus = String(status).trim().toLowerCase();
      const allowedStatuses = new Set(['pending', 'paid', 'disputed', 'approved', 'rejected', 'processing', 'processed', 'error']);
      if (!allowedStatuses.has(normalizedStatus)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status filter',
        });
      }
      whereClause.status = normalizedStatus;
    }

    if (typeof isDisputed !== 'undefined' && isDisputed !== '') {
      const normalized = String(isDisputed).trim().toLowerCase();
      if (['true', '1', 'yes'].includes(normalized)) {
        whereClause.status = 'disputed';
      }
    }

    const include = [
      {
        model: Account,
        as: 'vendor',
        attributes: ['id', 'accountName', 'vendorCode']
      }
    ];

    const searchTerm = String(search || vendorName || '').trim();
    if (searchTerm) {
      const q = `%${searchTerm}%`;
      whereClause[Op.or] = [
        { invoiceNumber: { [Op.iLike]: q } },
        { vendorCode: { [Op.iLike]: q } },
        { '$vendor.accountName$': { [Op.iLike]: q } },
      ];
    }

    const { rows, count } = await VendorInvoice.findAndCountAll({
      where: whereClause,
      include,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      distinct: true,
      subQuery: false,
    });

    res.status(200).json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching vendor invoices:', error);
    res.status(500).json({
      message: 'Failed to fetch vendor invoices',
      error: error.message
    });
  }
};

exports.getVendorInvoiceFiles = async (req, res) => {
  try {
    const { id } = req.params;
    const invoice = await VendorInvoice.findByPk(id);

    if (!invoice) {
      return res.status(404).json({ message: 'Vendor invoice not found' });
    }

    const storedPaths = parseStoredFilePaths(invoice.filePaths);
    const files = storedPaths
      .map((storedPath, index) => {
        const absolutePath = normalizeStoredPath(storedPath);
        if (!absolutePath) return null;

        const ext = path.extname(storedPath || absolutePath);
        const originalName = path.basename(storedPath || absolutePath);

        return {
          fileIndex: index,
          storedPath,
          originalName,
          extension: ext,
          category: getFileExtCategory(ext),
          viewUrl: `/api/vendor-invoices/${invoice.id}/files/${index}/download?disposition=inline`,
          downloadUrl: `/api/vendor-invoices/${invoice.id}/files/${index}/download`,
        };
      })
      .filter(Boolean);

    return res.status(200).json({
      success: true,
      data: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        files,
      },
    });
  } catch (error) {
    console.error('Error fetching vendor invoice files:', error);
    return res.status(500).json({
      message: 'Failed to fetch vendor invoice files',
      error: error.message,
    });
  }
};

exports.downloadVendorInvoiceFile = async (req, res) => {
  try {
    const { id, fileIndex } = req.params;
    const disposition = String(req.query.disposition || '').toLowerCase() === 'inline' ? 'inline' : 'attachment';

    const invoice = await VendorInvoice.findByPk(id);
    if (!invoice) {
      return res.status(404).json({ message: 'Vendor invoice not found' });
    }

    const storedPaths = parseStoredFilePaths(invoice.filePaths);
    const index = Number(fileIndex);

    if (!Number.isInteger(index) || index < 0 || index >= storedPaths.length) {
      return res.status(404).json({ message: 'Vendor invoice file not found' });
    }

    const storedPath = storedPaths[index];
    const absolutePath = normalizeStoredPath(storedPath);
    if (!absolutePath) {
      return res.status(404).json({ message: 'Vendor invoice file path is invalid' });
    }

    try {
      await fs.promises.access(absolutePath, fs.constants.R_OK);
    } catch (_error) {
      return res.status(404).json({ message: 'Vendor invoice file not found on disk' });
    }

    const safeName = path.basename(storedPath || absolutePath);
    if (disposition === 'inline') {
      return res.sendFile(absolutePath, {
        headers: {
          'Content-Disposition': `inline; filename="${safeName}"`,
        },
      });
    }

    return res.download(absolutePath, safeName);
  } catch (error) {
    console.error('Error downloading vendor invoice file:', error);
    return res.status(500).json({
      message: 'Failed to download vendor invoice file',
      error: error.message,
    });
  }
};

exports.deleteVendorInvoiceFile = async (req, res) => {
  try {
    const { id, fileIndex } = req.params;
    const invoice = await VendorInvoice.findByPk(id);

    if (!invoice) {
      return res.status(404).json({ message: 'Vendor invoice not found' });
    }

    const index = Number(fileIndex);
    const storedPaths = parseStoredFilePaths(invoice.filePaths);

    if (!Number.isInteger(index) || index < 0 || index >= storedPaths.length) {
      return res.status(404).json({ message: 'Vendor invoice file not found' });
    }

    const removedPath = storedPaths[index];
    await removeFileSafe(removedPath);

    storedPaths.splice(index, 1);
    invoice.filePaths = JSON.stringify(storedPaths);
    await invoice.save();

    return res.status(200).json({
      success: true,
      message: 'Vendor invoice file deleted successfully',
      data: {
        invoiceId: invoice.id,
        filePaths: storedPaths,
      },
    });
  } catch (error) {
    console.error('Error deleting vendor invoice file:', error);
    return res.status(500).json({
      message: 'Failed to delete vendor invoice file',
      error: error.message,
    });
  }
};

exports.addVendorInvoiceFiles = async (req, res) => {
  const uploadedFiles = Array.isArray(req.files) ? req.files : [];

  try {
    const { id } = req.params;
    const invoice = await VendorInvoice.findByPk(id);

    if (!invoice) {
      await cleanupUploadedFiles(uploadedFiles);
      return res.status(404).json({ message: 'Vendor invoice not found' });
    }

    if (String(invoice.status).toLowerCase() === 'paid') {
      await cleanupUploadedFiles(uploadedFiles);
      return res.status(400).json({ message: 'Cannot upload files to a paid vendor invoice' });
    }

    if (uploadedFiles.length === 0) {
      return res.status(400).json({ message: 'Please upload at least one file' });
    }

    const existingPaths = parseStoredFilePaths(invoice.filePaths);
    const appendedPaths = uploadedFiles
      .map((file) => toStoredRelativePath(path.resolve(file.path)))
      .filter(Boolean);

    if (appendedPaths.length === 0) {
      await cleanupUploadedFiles(uploadedFiles);
      return res.status(400).json({ message: 'No valid files were uploaded' });
    }

    const merged = [...existingPaths, ...appendedPaths];
    invoice.filePaths = JSON.stringify(merged);
    await invoice.save();

    return res.status(200).json({
      success: true,
      message: 'Files uploaded successfully',
      data: {
        invoiceId: invoice.id,
        filePaths: merged,
      },
    });
  } catch (error) {
    await cleanupUploadedFiles(uploadedFiles);
    console.error('Error uploading files to vendor invoice:', error);
    return res.status(500).json({
      message: 'Failed to upload files to vendor invoice',
      error: error.message,
    });
  }
};

exports.updateVendorInvoice = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const invoice = await VendorInvoice.findByPk(id, { transaction });

    if (!invoice) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Vendor invoice not found' });
    }

    if (String(invoice.status).toLowerCase() === 'paid') {
      await transaction.rollback();
      return res.status(400).json({ message: 'Paid vendor invoices cannot be edited' });
    }

    const payload = req.body || {};

    const nextValues = {
      invoiceNumber: payload.invoiceNumber != null ? String(payload.invoiceNumber).trim() : invoice.invoiceNumber,
      issueDate: payload.issueDate || invoice.issueDate,
      startDate: payload.startDate || invoice.startDate,
      endDate: payload.endDate || invoice.endDate,
      currency: payload.currency || invoice.currency,
      grandTotal: payload.grandTotal != null ? Number(payload.grandTotal) : Number(invoice.grandTotal),
      totalSeconds: payload.totalSeconds != null ? Number(payload.totalSeconds) : Number(invoice.totalSeconds),
    };

    if (!nextValues.invoiceNumber) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Invoice number is required' });
    }

    if (Number.isNaN(nextValues.grandTotal) || nextValues.grandTotal < 0) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Grand total must be a non-negative number' });
    }

    if (!Number.isInteger(nextValues.totalSeconds) || nextValues.totalSeconds < 0) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Total seconds must be a non-negative integer' });
    }

    if (new Date(nextValues.startDate) > new Date(nextValues.endDate)) {
      await transaction.rollback();
      return res.status(400).json({ message: 'End date must be after start date' });
    }

    const duplicate = await VendorInvoice.findOne({
      where: {
        vendorCode: invoice.vendorCode,
        startDate: nextValues.startDate,
        endDate: nextValues.endDate,
        id: { [Op.ne]: invoice.id },
      },
      transaction,
    });

    if (duplicate) {
      await transaction.rollback();
      return res.status(409).json({ message: 'A vendor invoice already exists for this billing period' });
    }

    const duplicateInvoiceNumber = await VendorInvoice.findOne({
      where: {
        invoiceNumber: nextValues.invoiceNumber,
        id: { [Op.ne]: invoice.id },
      },
      transaction,
    });

    if (duplicateInvoiceNumber) {
      await transaction.rollback();
      return res.status(409).json({ message: 'Invoice number already exists' });
    }

    await invoice.update(nextValues, { transaction });
    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: 'Vendor invoice updated successfully',
      invoice,
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error updating vendor invoice:', error);
    return res.status(500).json({
      message: 'Failed to update vendor invoice',
      error: error.message,
    });
  }
};

exports.updateVendorInvoiceStatus = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const {
      status,
      paymentMethod,
      paymentDate,
      transactionId,
      referenceNumber,
      notes,
      creditNoteAmount,
    } = req.body || {};
    const normalizedStatus = status == null ? '' : String(status).trim().toLowerCase();

    const invoice = await VendorInvoice.findByPk(id, { transaction });
    if (!invoice) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Vendor invoice not found' });
    }

    if (normalizedStatus && !['pending', 'disputed', 'paid'].includes(normalizedStatus)) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Invalid vendor invoice status' });
    }

    if (String(invoice.status).toLowerCase() === 'paid') {
      await transaction.rollback();
      return res.status(409).json({ message: 'Payment already recorded for this vendor invoice' });
    }

    if (normalizedStatus && normalizedStatus !== 'paid') {
      const currentStatus = String(invoice.status || '').toLowerCase();
      if (currentStatus === 'disputed' && normalizedStatus === 'pending') {
        console.warn('Blocked vendor invoice status downgrade (disputed -> pending)', {
          invoiceId: invoice.id,
          actorId: req.user?.id || null,
        });
        await transaction.rollback();
        return res.status(409).json({
          message: 'Disputed vendor invoices cannot be moved back to pending automatically',
        });
      }

      invoice.status = normalizedStatus;
      await invoice.save({ transaction });
      await transaction.commit();
      return res.status(200).json({
        message: 'Vendor invoice status updated successfully',
        invoice,
      });
    }

    if (!paymentMethod) {
      await transaction.rollback();
      return res.status(400).json({ message: 'paymentMethod is required to record vendor payment' });
    }

    const normalizedCreditNoteAmount = Number(creditNoteAmount || 0);
    if (Number.isNaN(normalizedCreditNoteAmount) || normalizedCreditNoteAmount < 0) {
      await transaction.rollback();
      return res.status(400).json({ message: 'creditNoteAmount must be a non-negative number' });
    }

    const invoiceGrandTotal = Number(invoice.grandTotal || 0);
    if (normalizedCreditNoteAmount > invoiceGrandTotal) {
      await transaction.rollback();
      return res.status(400).json({ message: 'creditNoteAmount cannot exceed the invoice grand total' });
    }

    const existingPayment = await Payment.findOne({
      where: {
        vendorInvoiceId: invoice.id,
        partyType: 'vendor',
        paymentDirection: 'outbound',
      },
      transaction,
    });

    if (existingPayment) {
      await transaction.rollback();
      return res.status(409).json({ message: 'Payment already exists for this vendor invoice' });
    }

    const account = await Account.findByPk(invoice.vendorId, { transaction });
    const payableAmount = parseFloat((invoiceGrandTotal - normalizedCreditNoteAmount).toFixed(4));
    const normalizedPaymentDate = parsePaymentDate(paymentDate);

    invoice.status = 'paid';
    invoice.creditNoteAmount = parseFloat(normalizedCreditNoteAmount.toFixed(2));
    await invoice.save({ transaction });

    const paymentNumber = await generatePaymentNumber();
    const computedNotes = notes
      ? `${notes}${normalizedCreditNoteAmount > 0 ? ` | Credit note applied: ${normalizedCreditNoteAmount.toFixed(2)}` : ''}`
      : `Vendor payment for invoice ${invoice.invoiceNumber}${normalizedCreditNoteAmount > 0 ? ` (Credit note: ${normalizedCreditNoteAmount.toFixed(2)})` : ''}`;

    await Payment.create({
      paymentNumber,
      receiptNumber: `VND-${paymentNumber.split('-').slice(1).join('-')}`,
      customerGatewayId: account?.gatewayId || invoice.vendorCode || String(invoice.vendorId || invoice.id),
      customerCode: invoice.vendorCode,
      customerName: account?.accountName || invoice.vendorCode,
      partyType: 'vendor',
      paymentDirection: 'outbound',
      amount: payableAmount,
      currency: invoice.currency || account?.currency || 'USD',
      paymentDate: normalizedPaymentDate,
      paymentMethod,
      transactionId: transactionId || `VENDOR-PAY-${invoice.invoiceNumber}`,
      referenceNumber: referenceNumber || invoice.invoiceNumber,
      allocatedAmount: payableAmount,
      unappliedAmount: 0,
      creditNoteAmount: parseFloat(normalizedCreditNoteAmount.toFixed(2)),
      notes: computedNotes,
      vendorInvoiceId: invoice.id,
      recordedBy: req.user?.id || null,
      recordedDate: Date.now(),
    }, { transaction });

    await transaction.commit();

    res.status(200).json({
      success: true,
      message: 'Vendor payment recorded successfully',
      invoice,
      payment: {
        amount: payableAmount,
        creditNoteAmount: parseFloat(normalizedCreditNoteAmount.toFixed(2)),
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error updating vendor invoice status:', error);
    res.status(500).json({
      message: 'Failed to record vendor payment',
      error: error.message
    });
  }
};


/* ===================== DELETE VENDOR INVOICE ===================== */
exports.deleteVendorInvoice = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const invoice = await VendorInvoice.findByPk(id, { transaction });
    if (!invoice) {
      return res.status(404).json({ message: 'Vendor invoice not found' });
    }

    const account = await resolveVendorAccount(
      { vendorId: invoice.vendorId, vendorCode: invoice.vendorCode },
      transaction,
    );
    const billingDatesBefore = getBillingDateSnapshot(account);

    await Payment.destroy({
      where: {
        vendorInvoiceId: invoice.id,
        partyType: 'vendor',
        paymentDirection: 'outbound'
      },
      transaction
    });

    // delete any uploaded files associated with this invoice
    if (invoice.filePaths) {
      try {
        const paths = JSON.parse(invoice.filePaths);
        if (Array.isArray(paths) && paths.length > 0) {
          await Promise.allSettled(paths.map((filePath) => removeFileSafe(filePath)));
        }
      } catch (e) {
        console.warn('Failed to parse or delete invoice files', e);
      }
    }

    await invoice.destroy({ transaction });
    await recalculateVendorBillingDatesAfterDelete(account, invoice, transaction);

    let billingDatesAfter = null;
    if (account) {
      await account.reload({ transaction });
      billingDatesAfter = getBillingDateSnapshot(account);
    }

    await transaction.commit();

    res.status(200).json({
      message: 'Vendor invoice deleted successfully',
      billingDateRestore: {
        accountFound: Boolean(account),
        stream: 'vendor',
        before: billingDatesBefore,
        after: billingDatesAfter,
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error deleting vendor invoice:', error);
    res.status(500).json({
      message: 'Failed to delete vendor invoice',
      error: error.message
    });
  }
};
