const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const XLSX = require('xlsx');
const fs = require('fs');
const { Op, Sequelize } = require('sequelize');
const CustomerRate = require('../models/CustomerRate');
const Account = require('../models/Account');
const User = require('../models/User');
const sequelize = require('../models/db');
const {
  ensureDirSync,
  toStoredRelativePath,
} = require('../config/storage');

// Configure upload directory for customer rates Excel files
const customerRatesUploadDir = path.join(__dirname, '../uploads/customer_rates');

const customerRatesStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureDirSync(customerRatesUploadDir);
    cb(null, customerRatesUploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeExt = ['.xlsx', '.xls', '.csv'].includes(ext) ? ext : '.xlsx';
    cb(null, `${Date.now()}-${crypto.randomUUID()}${safeExt}`);
  },
});

const customerRatesUpload = multer({
  storage: customerRatesStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!['.xlsx', '.xls', '.csv'].includes(ext)) {
      return cb(new Error('Invalid file type. Allowed: XLSX, XLS, CSV'));
    }
    cb(null, true);
  },
});

const deactivateActiveRates = async ({ accountId, trunk, keepId = null, transaction }) => {
  const where = {
    accountId,
    trunk,
    isActive: true,
  };

  if (keepId != null) {
    where.id = { [Op.ne]: keepId };
  }

  return CustomerRate.update(
    { isActive: false },
    { where, transaction }
  );
};

/**
 * Parse Excel file and extract rate data
 * Expects columns: destination, rate, currency, effectiveDate, etc.
 */
const parseExcelFile = async (filePath) => {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);

    return data.map(row => {
      // Normalize effective date from the Excel Date column and drop the raw Date field
      const dateValue = row.effectiveDate ?? row.EffectiveDate ?? row['effective date'] ?? row['Effective Date'] ?? row.Date ?? row.date;
      const { Date: _excelDate, date: _excelDateLower, effectiveDate: _effectiveDate, EffectiveDate: _effectiveDateCaps, ['effective date']: _effectiveDateSpaced, ['Effective Date']: _effectiveDateSpacedCaps, ...rest } = row;
      let effectiveDate = '';
      
      if (dateValue) {
        // If it's a number (Excel serial date), convert it using XLSX format function
        if (typeof dateValue === 'number') {
          effectiveDate = XLSX.SSF.format('yyyy-mm-dd', dateValue);
        } else if (typeof dateValue === 'string' && dateValue.trim()) {
          // If it's already a string, validate and use it
          effectiveDate = dateValue.trim();
        }
      }

      const rawRate = row.rate ?? row.Rate ?? row['Rate(Minute)'] ?? row['Rate (Minute)'] ?? row['Rate/minute'] ?? row['Rate per minute'] ?? 0;

      return {
        ...rest,
        destination: row.destination ?? row.Destination ?? '',
        areaName: row.areaName ?? row['Area name'] ?? row.AreaName ?? row['Area Name'] ?? '',
        rate: typeof rawRate === 'number' ? rawRate : parseFloat(rawRate) || 0,
        currency: row.currency ?? row.Currency ?? 'USD',
        effectiveDate,
        description: row.description ?? row.Description ?? '',
        rateType: row['Rate type'] ?? row.rateType ?? '',
        lockType: row['Lock type'] ?? row.lockType ?? '',
        areaPrefix: row['Area prefix'] ?? row.areaPrefix ?? '',
        ratePrefix: row['Rate prefix'] ?? row.ratePrefix ?? '',
      };
    });
  } catch (error) {
    throw new Error(`Failed to parse Excel file: ${error.message}`);
  }
};

/**
 * POST /api/customer-rates/upload
 * Upload Excel file with rates for a customer/trunk combination
 */
router.post('/upload', customerRatesUpload.single('file'), async (req, res) => {
  try {
    const { accountId, trunk } = req.body;
    const userId = req.user?.id;

    console.debug('[customer-rates][upload] incoming accountId:', accountId, 'trunk:', trunk, 'user:', userId);

    if (!accountId || !trunk) {
      if (req.file) {
        fs.unlink(req.file.path, () => {});
      }
      return res.status(400).json({ error: 'accountId and trunk are required' });
    }

    // Verify account exists. Accept either numeric PK or external accountId string.
    let account = await Account.findByPk(accountId);
    if (!account && accountId && typeof accountId === 'string') {
      account = await Account.findOne({ where: { accountId } });
    }
    if (!account) {
      if (req.file) {
        fs.unlink(req.file.path, () => {});
      }
      return res.status(404).json({ error: 'Account not found' });
    }

    // Parse Excel file
    const rateData = await parseExcelFile(req.file.path);

    if (!rateData || rateData.length === 0) {
      if (req.file) {
        fs.unlink(req.file.path, () => {});
      }
      return res.status(400).json({ error: 'No valid data found in Excel file' });
    }

    const { customerRate, changeTracking } = await sequelize.transaction(async (transaction) => {
      // Get current rates for comparison
      const existingRates = await CustomerRate.findAll({
        where: { accountId: account.id, trunk, isActive: true },
        order: [['uploadedAt', 'DESC']],
        transaction,
      });

      const previousRates = existingRates && existingRates.length > 0
        ? existingRates[0].rateData
        : [];

      // Create tracking info
      const tracking = {
        added: rateData.filter(
          newRate => !Array.isArray(previousRates) || !previousRates.some(
            prev => prev.destination === newRate.destination
          )
        ),
        updated: rateData.filter(
          newRate => Array.isArray(previousRates) && previousRates.some(
            prev => prev.destination === newRate.destination && JSON.stringify(prev) !== JSON.stringify(newRate)
          )
        ),
        removed: (Array.isArray(previousRates) ? previousRates : []).filter(
          prevRate => !rateData.some(
            newRate => newRate.destination === prevRate.destination
          )
        ),
        timestamp: new Date()
      };

      await deactivateActiveRates({ accountId: account.id, trunk, transaction });

      // Create new customer rate record
      const createdRate = await CustomerRate.create({
        accountId: account.id,
        trunk,
        rateData,
        uploadedBy: userId,
        fileReference: req.file.originalname,
        isActive: true
      }, { transaction });

      return { customerRate: createdRate, changeTracking: tracking };
    });

    res.json({
      success: true,
      data: customerRate,
      changeTracking,
      summary: {
        totalRates: rateData.length,
        added: changeTracking.added.length,
        updated: changeTracking.updated.length,
        removed: changeTracking.removed.length
      }
    });
  } catch (error) {
    if (req.file) {
      fs.unlink(req.file.path, () => {});
    }
    console.error('Customer rates upload error:', error);
    res.status(500).json({ error: error.message || 'Failed to upload customer rates' });
  }
});

/**
 * GET /api/customer-rates
 * Retrieve customer rates with optional filtering
 */
router.get('/', async (req, res) => {
  try {
    const { accountId, trunk, isActive = true } = req.query;
    const where = {};

    console.debug('[customer-rates][list] query:', req.query);

    // Accept either numeric PK or external accountId string
    if (accountId) {
      // If looks like a number, use as-is
      if (!Number.isNaN(Number(accountId))) {
        where.accountId = Number(accountId);
      } else {
        // try to resolve by external accountId field
        const acct = await Account.findOne({ where: { accountId } });
        if (acct) where.accountId = acct.id;
        else where.accountId = accountId; // fallback (may yield no results)
      }
    }
    if (trunk) where.trunk = trunk;
    if (isActive !== undefined) where.isActive = isActive === 'true';

    console.debug('[customer-rates][list] resolved where:', where);

    const rates = await CustomerRate.findAll({
      where,
      include: [
        { model: Account, as: 'account', attributes: ['id', 'accountName'] },
        { model: User, as: 'uploader', attributes: ['id', 'email', 'first_name', 'last_name'] }
      ],
      order: [['uploadedAt', 'DESC']]
    });

    res.json({ success: true, data: rates });
  } catch (error) {
    console.error('Get customer rates error:', error);
    res.status(500).json({ error: error.message || 'Failed to retrieve customer rates' });
  }
});

/**
 * GET /api/customer-rates/:id
 * Retrieve a specific customer rate record
 */
router.get('/:id', async (req, res) => {
  try {
    const rate = await CustomerRate.findByPk(req.params.id, {
      include: [
        { model: Account, as: 'account', attributes: ['id', 'accountName', 'trunks'] },
        { model: User, as: 'uploader', attributes: ['id', 'email', 'first_name', 'last_name'] }
      ]
    });

    if (!rate) {
      return res.status(404).json({ error: 'Customer rate not found' });
    }

    res.json({ success: true, data: rate });
  } catch (error) {
    console.error('Get customer rate error:', error);
    res.status(500).json({ error: error.message || 'Failed to retrieve customer rate' });
  }
});

/**
 * PUT /api/customer-rates/:id
 * Update a specific customer rate (mark previous as inactive, create new)
 */
router.put('/:id', async (req, res) => {
  try {
    const { rateData, action } = req.body; // action: 'replace-all' or 'update-changed'

    const updatedRate = await sequelize.transaction(async (transaction) => {
      const existingRate = await CustomerRate.findByPk(req.params.id, { transaction });
      if (!existingRate) {
        return null;
      }

      let newRates;
      if (action === 'replace-all') {
        // Replace all rates with new data
        newRates = rateData;
      } else if (action === 'update-changed') {
        // Merge old and new, keeping unchanged rates
        const oldData = Array.isArray(existingRate.rateData) ? existingRate.rateData : [];
        newRates = oldData.map(oldRate => {
          const newRate = rateData.find(r => r.destination === oldRate.destination);
          return newRate || oldRate;
        });
        // Add any new destinations
        rateData.forEach(newRate => {
          if (!newRates.some(r => r.destination === newRate.destination)) {
            newRates.push(newRate);
          }
        });
      } else {
        newRates = rateData;
      }

      await deactivateActiveRates({ accountId: existingRate.accountId, trunk: existingRate.trunk, transaction });

      // Mark current record inactive before saving the replacement version
      await existingRate.update({ isActive: false }, { transaction });

      // Create new rate record
      return CustomerRate.create({
        accountId: existingRate.accountId,
        trunk: existingRate.trunk,
        rateData: newRates,
        uploadedBy: req.user?.id,
        fileReference: existingRate.fileReference,
        isActive: true
      }, { transaction });
    });

    if (!updatedRate) {
      return res.status(404).json({ error: 'Customer rate not found' });
    }

    res.json({
      success: true,
      data: updatedRate,
      message: `Rates updated with action: ${action || 'replace-all'}`
    });
  } catch (error) {
    console.error('Update customer rate error:', error);
    res.status(500).json({ error: error.message || 'Failed to update customer rate' });
  }
});

/**
 * POST /api/customer-rates/:id/revert
 * Revert to a previous version of rates
 */
router.post('/:id/revert', async (req, res) => {
  try {
    const revertedRate = await sequelize.transaction(async (transaction) => {
      const previousRate = await CustomerRate.findByPk(req.params.id, { transaction });
      if (!previousRate) {
        return null;
      }

      await deactivateActiveRates({ accountId: previousRate.accountId, trunk: previousRate.trunk, transaction });

      // Restore previous
      return CustomerRate.create({
        accountId: previousRate.accountId,
        trunk: previousRate.trunk,
        rateData: previousRate.rateData,
        uploadedBy: req.user?.id,
        fileReference: `${previousRate.fileReference} (reverted)`,
        isActive: true
      }, { transaction });
    });

    if (!revertedRate) {
      return res.status(404).json({ error: 'Customer rate not found' });
    }

    res.json({ success: true, data: revertedRate, message: 'Rates reverted to previous version' });
  } catch (error) {
    console.error('Revert customer rate error:', error);
    res.status(500).json({ error: error.message || 'Failed to revert customer rate' });
  }
});

/**
 * DELETE /api/customer-rates/:id
 * Permanently delete a customer rate record
 */
router.delete('/:id', async (req, res) => {
  try {
    const rate = await CustomerRate.findByPk(req.params.id);
    if (!rate) {
      return res.status(404).json({ error: 'Customer rate not found' });
    }

    await rate.destroy();

    res.json({ success: true, message: 'Customer rate deleted' });
  } catch (error) {
    console.error('Delete customer rate error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete customer rate' });
  }
});

/**
 * GET /api/customer-rates/:accountId/history
 * Get full rate history for an account/trunk
 */
router.get('/history/:accountId', async (req, res) => {
  try {
    const { trunk } = req.query;
    // Resolve account param which may be numeric PK or external accountId
    let resolvedAccountId = req.params.accountId;
    if (resolvedAccountId && !Number.isNaN(Number(resolvedAccountId))) {
      resolvedAccountId = Number(resolvedAccountId);
    } else {
      const acct = await Account.findOne({ where: { accountId: resolvedAccountId } });
      if (acct) resolvedAccountId = acct.id;
    }
    const where = { accountId: resolvedAccountId };

    if (trunk) where.trunk = trunk;

    const history = await CustomerRate.findAll({
      where,
      include: [
        { model: Account, as: 'account', attributes: ['id', 'accountName'] },
        { model: User, as: 'uploader', attributes: ['id', 'email', 'first_name', 'last_name'] }
      ],
      order: [['uploadedAt', 'DESC']]
    });

    res.json({ success: true, data: history });
  } catch (error) {
    console.error('Get customer rate history error:', error);
    res.status(500).json({ error: error.message || 'Failed to retrieve history' });
  }
});

module.exports = router;
