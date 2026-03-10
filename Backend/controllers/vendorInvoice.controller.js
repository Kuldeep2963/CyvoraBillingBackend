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

    // Update account balance/credit limit
    if (account.billingType === 'postpaid') {
      // For postpaid, credit limit decreases as usage (invoice) increases
      await account.decrement('creditLimit', { by: grandTotal, transaction });
    } else {
      // For prepaid, balance decreases as usage (invoice) increases
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

    invoice.status = status;
    await invoice.save();

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
