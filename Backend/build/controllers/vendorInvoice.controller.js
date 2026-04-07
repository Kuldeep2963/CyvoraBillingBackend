const { Op } = require('sequelize');
const VendorInvoice = require('../models/Vendorinvoice');
const Account = require('../models/Account');
const Payment = require('../models/Payment');
const sequelize = require('../config/database');
const path = require('path');
const fs = require('fs');
const { normalizeStoredPath, toStoredRelativePath } = require('../config/storage');

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
      totalSeconds
    } = req.body;

    let finalVendorId = vendorId;
    let finalVendorCode = vendorCode;
    let account = null;

    // Find account and resolve IDs/Codes
    if (finalVendorId) {
      account = await Account.findByPk(finalVendorId, { transaction });
    } else if (finalVendorCode) {
      account = await Account.findOne({ where: { vendorCode: finalVendorCode }, transaction });
    }

    if (!account) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Vendor account not found' });
    }

    finalVendorId = account.id;
    finalVendorCode = account.vendorCode;

    const filePaths = uploadedFiles
      .map((file) => toStoredRelativePath(path.resolve(file.path)))
      .filter(Boolean);

    const invoice = await VendorInvoice.create({
      vendorId: finalVendorId,
      vendorCode: finalVendorCode,
      invoiceNumber,
      issueDate,
      startDate,
      endDate,
      grandTotal,
      currency,
      totalSeconds,
      filePaths: JSON.stringify(filePaths),
      status: 'pending'
    }, { transaction });

    // Update account balance/credit limit (same semantics as customer invoices)
    if (account.billingType === 'postpaid') {
      if (Number(account.creditLimit) < grandTotal) {
        throw new Error('Credit limit exceeded – cannot generate vendor invoice');
      }
      await account.decrement('creditLimit', { by: grandTotal, transaction });
    } else {
      // Prepaid vendor accounts are allowed to go negative after invoice generation.
      await account.decrement('balance', { by: grandTotal, transaction });
    }

    await transaction.commit();

    res.status(201).json({
      message: 'Vendor invoice created successfully',
      invoice
    });
  } catch (error) {
    if (transaction) await transaction.rollback();
    await cleanupUploadedFiles(uploadedFiles);
    console.error('Error creating vendor invoice:', error);
    res.status(500).json({
      message: 'Failed to create vendor invoice',
      error: error.message
    });
  }
};

exports.getVendorInvoices = async (req, res) => {
  try {
    const { vendorCode, vendorId, startDate, endDate, search, vendorName, status } = req.query;
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
      whereClause.status = String(status).trim();
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
        invoiceNumber: nextValues.invoiceNumber,
        id: { [Op.ne]: invoice.id },
      },
      transaction,
    });

    if (duplicate) {
      await transaction.rollback();
      return res.status(409).json({ message: 'Invoice number already exists' });
    }

    const oldGrandTotal = Number(invoice.grandTotal) || 0;
    const delta = nextValues.grandTotal - oldGrandTotal;

    if (delta !== 0 && invoice.vendorId) {
      const account = await Account.findByPk(invoice.vendorId, { transaction });
      if (account) {
        if (account.billingType === 'postpaid') {
          await account.decrement('creditLimit', { by: delta, transaction });
        } else {
          await account.decrement('balance', { by: delta, transaction });
        }
      }
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
  try {
    const { id } = req.params;
    const { status } = req.body;

    const invoice = await VendorInvoice.findByPk(id);
    if (!invoice) {
      return res.status(404).json({ message: 'Vendor invoice not found' });
    }

    const prevStatus = invoice.status;
    invoice.status = status;
    await invoice.save();

    // mirror credit-limit restoration for postpaid vendors when they pay
    if (prevStatus !== 'paid' && status === 'paid') {
      const account = await Account.findByPk(invoice.vendorId);
      if (account && account.billingType === 'postpaid') {
        const orig = parseFloat(account.originalCreditLimit) || 0;
        let newLimit = parseFloat(account.creditLimit) + Number(invoice.grandTotal);
        if (orig && newLimit > orig) newLimit = orig;
        await account.update({ creditLimit: newLimit });
      }

      const existingPayment = await Payment.findOne({
        where: {
          vendorInvoiceId: invoice.id,
          partyType: 'vendor',
          paymentDirection: 'outbound'
        }
      });

      if (!existingPayment) {
        const paymentNumber = await generatePaymentNumber();

        await Payment.create({
          paymentNumber,
          receiptNumber: `VND-${paymentNumber.split('-').slice(1).join('-')}`,
          customerGatewayId: account?.gatewayId || invoice.vendorCode || String(invoice.vendorId || invoice.id),
          customerCode: invoice.vendorCode,
          customerName: account?.accountName || invoice.vendorCode,
          partyType: 'vendor',
          paymentDirection: 'outbound',
          amount: parseFloat(invoice.grandTotal),
          currency: invoice.currency || account?.currency || 'USD',
          paymentDate: Date.now(),
          paymentMethod: 'bank_transfer',
          transactionId: `VENDOR-PAY-${invoice.invoiceNumber}`,
          referenceNumber: invoice.invoiceNumber,
          allocatedAmount: parseFloat(invoice.grandTotal),
          unappliedAmount: 0,
          notes: `Auto-recorded vendor payment for invoice ${invoice.invoiceNumber}`,
          vendorInvoiceId: invoice.id,
          recordedDate: Date.now()
        });
      }
    }

    res.status(200).json({
      message: 'Vendor invoice status updated successfully',
      invoice
    });
  } catch (error) {
    console.error('Error updating vendor invoice status:', error);
    res.status(500).json({
      message: 'Failed to update vendor invoice status',
      error: error.message
    });
  }
};


/* ===================== DELETE VENDOR INVOICE ===================== */
exports.deleteVendorInvoice = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const invoice = await VendorInvoice.findByPk(id);
    if (!invoice) {
      return res.status(404).json({ message: 'Vendor invoice not found' });
    }

    // restore any funds/credit that were deducted when the invoice was created
    if (invoice.vendorId) {
      const account = await Account.findByPk(invoice.vendorId, { transaction });
      if (account) {
        const amount = Number(invoice.grandTotal) || 0;
        if (account.billingType === 'postpaid') {
          const orig = parseFloat(account.originalCreditLimit) || 0;
          let newLimit = parseFloat(account.creditLimit) + amount;
          if (orig && newLimit > orig) newLimit = orig;
          await account.update({ creditLimit: newLimit }, { transaction });
        } else {
          let newBal = parseFloat(account.balance) + amount;
          await account.update({ balance: newBal }, { transaction });
        }
      }
    }

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
    await transaction.commit();

    res.status(200).json({ message: 'Vendor invoice deleted successfully' });
  } catch (error) {
    await transaction.rollback();
    console.error('Error deleting vendor invoice:', error);
    res.status(500).json({
      message: 'Failed to delete vendor invoice',
      error: error.message
    });
  }
};
