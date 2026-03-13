const { Op } = require('sequelize');
const VendorInvoice = require('../models/Vendorinvoice');
const Account = require('../models/Account');
const sequelize = require('../config/database');
const path = require('path');
const fs = require('fs');

exports.createVendorInvoice = async (req, res) => {
  const transaction = await sequelize.transaction();
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

    const filePaths = req.files ? req.files.map(file => file.path) : [];

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
      if (Number(account.balance) < grandTotal) {
        throw new Error('Insufficient prepaid balance – cannot generate vendor invoice');
      }
      await account.decrement('balance', { by: grandTotal, transaction });
    }

    await transaction.commit();

    res.status(201).json({
      message: 'Vendor invoice created successfully',
      invoice
    });
  } catch (error) {
    if (transaction) await transaction.rollback();
    console.error('Error creating vendor invoice:', error);
    res.status(500).json({
      message: 'Failed to create vendor invoice',
      error: error.message
    });
  }
};

exports.getVendorInvoices = async (req, res) => {
  try {
    const { vendorCode, vendorId, startDate, endDate } = req.query;
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

    const invoices = await VendorInvoice.findAll({
      where: whereClause,
      include: [
        {
          model: Account,
          as: 'vendor',
          attributes: ['id', 'accountName', 'vendorCode']
        }
      ],
      order: [['createdAt', 'DESC']]
    });
    res.status(200).json(invoices);
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

    // delete any uploaded files associated with this invoice
    if (invoice.filePaths) {
      try {
        const paths = JSON.parse(invoice.filePaths);
        paths.forEach(p => {
          if (p && fs.existsSync(p)) {
            fs.unlinkSync(p);
          }
        });
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
