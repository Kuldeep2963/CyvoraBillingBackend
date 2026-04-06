const { Op } = require('sequelize');
const VendorInvoice = require('../models/Vendorinvoice');
const Account = require('../models/Account');
const Payment = require('../models/Payment');
const sequelize = require('../config/database');
const path = require('path');
const fs = require('fs');
const { normalizeStoredPath, toStoredRelativePath } = require('../config/storage');

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

    // Update account balance/credit limit.
    // Vendor invoices are allowed even when the remaining credit limit is insufficient;
    // postpaid creditLimit can temporarily go below zero until payment is recorded.
    if (account.billingType === 'postpaid') {
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
