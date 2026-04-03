const express = require('express');
const router = express.Router();
const Customer = require('../models/Account');
const User = require('../models/User');
const sequelize = require('../models/db');
const { Op, Sequelize } = require('sequelize');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const {
  accountDocumentUploadDir,
  ensureDirSync,
  toStoredRelativePath,
  normalizeStoredPath,
} = require('../config/storage');

const accountDocMaxFileSizeMb = Math.max(1, Number(process.env.MAX_ACCOUNT_DOCUMENT_FILE_MB) || 25);
const accountDocMaxFileSize = accountDocMaxFileSizeMb * 1024 * 1024;
const accountDocAllowedExtensions = new Set([
  '.pdf', '.png', '.jpg', '.jpeg', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.txt',
]);

const accountDocStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureDirSync(accountDocumentUploadDir);
    cb(null, accountDocumentUploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeExt = accountDocAllowedExtensions.has(ext) ? ext : '';
    cb(null, `${Date.now()}-${crypto.randomUUID()}${safeExt}`);
  },
});

const accountDocUpload = multer({
  storage: accountDocStorage,
  limits: {
    fileSize: accountDocMaxFileSize,
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!accountDocAllowedExtensions.has(ext)) {
      return cb(new Error('Invalid document type. Allowed: PDF, PNG, JPG, DOC, DOCX, XLS, XLSX, CSV, TXT'));
    }
    cb(null, true);
  },
});

const removeStoredFileSafe = async (storedPathOrAbsolutePath) => {
  const fs = require('fs');
  const resolvedPath = normalizeStoredPath(storedPathOrAbsolutePath);
  if (!resolvedPath) return;
  try {
    await fs.promises.unlink(resolvedPath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn('Failed to delete account document:', resolvedPath, error.message);
    }
  }
};

const splitToList = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((v) => (v == null ? '' : String(v).trim()))
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
  }

  return [];
};

const normalizeContactChannels = (payload) => {
  const data = { ...payload };

  data.ratesEmails = splitToList(data.ratesEmails);
  data.billingEmails = splitToList(data.billingEmails || data.billingEmail);
  data.disputeEmails = splitToList(data.disputeEmails || data.disputeEmail);
  data.nocEmails = splitToList(data.nocEmails || data.nocEmail);

  data.ratesMobileNumber = splitToList(data.ratesMobileNumber);
  data.billingPhoneNumbers = splitToList(data.billingPhoneNumbers);
  data.disputePhoneNumber = splitToList(data.disputePhoneNumber);
  data.nocPhoneNumbers = splitToList(data.nocPhoneNumbers);

  // Keep current notification logic working via existing scalar fields.
  if (!data.billingEmail && data.billingEmails.length > 0) {
    data.billingEmail = data.billingEmails[0];
  }
  if (!data.disputeEmail && data.disputeEmails.length > 0) {
    data.disputeEmail = data.disputeEmails[0];
  }
  if (!data.nocEmail && data.nocEmails.length > 0) {
    data.nocEmail = data.nocEmails[0];
  }

  return data;
};

const normalizeAuthValues = (value) => {
  if (Array.isArray(value)) {
    return [...new Set(value.map((v) => String(v || '').trim()).filter(Boolean))];
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];

    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return [...new Set(parsed.map((v) => String(v || '').trim()).filter(Boolean))];
        }
      } catch (_error) {
        // Fall through to comma-delimited parsing.
      }
    }

    return [...new Set(trimmed.split(',').map((v) => v.trim()).filter(Boolean))];
  }

  if (value == null) return [];

  const single = String(value).trim();
  return single ? [single] : [];
};

const normalizeAuthFields = (payload) => {
  const data = { ...payload };

  data.customerauthenticationValue = normalizeAuthValues(data.customerauthenticationValue);
  data.vendorauthenticationValue = normalizeAuthValues(data.vendorauthenticationValue);

  return data;
};

const normalizeDocuments = (input) => {
  let parsed = input;

  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch (_error) {
      parsed = [];
    }
  }

  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((item) => {
      if (!item || typeof item !== 'object') return null;

      const title = String(item.title || '').trim();
      const filePath = String(item.filePath || '').trim();
      if (!title || !filePath) return null;

      return {
        id: String(item.id || crypto.randomUUID()),
        title,
        filePath,
        originalName: String(item.originalName || '').trim() || path.basename(filePath),
        uploadedAt: item.uploadedAt || new Date().toISOString(),
      };
    })
    .filter(Boolean);
};

const computeNextBillingDate = (lastBillingDate, billingCycle) => {
  const dt = new Date(lastBillingDate);
  if (Number.isNaN(dt.getTime())) return null;

  switch (billingCycle) {
    case 'daily':
      dt.setDate(dt.getDate() + 1);
      break;
    case 'weekly':
      dt.setDate(dt.getDate() + 7);
      break;
    case 'biweekly':
      dt.setDate(dt.getDate() + 14);
      break;
    case 'monthly':
      dt.setMonth(dt.getMonth() + 1);
      break;
    case 'quarterly':
      dt.setMonth(dt.getMonth() + 3);
      break;
    case 'annually':
      dt.setFullYear(dt.getFullYear() + 1);
      break;
    default:
      break;
  }

  return dt.toISOString().split('T')[0];
};

const applyBillingTypeAdjustments = (data) => {
  if (data.billingType === 'prepaid') {
    data.creditLimit = 0;
    data.originalCreditLimit = 0;
  } else if (data.billingType === 'postpaid') {
    if (data.creditLimit != null) {
      data.originalCreditLimit = data.creditLimit;
    }
    data.balance = 0;
  }

  if (data.lastbillingdate && data.billingCycle) {
    data.nextbillingdate = computeNextBillingDate(data.lastbillingdate, data.billingCycle);
  }

  return data;
};

const validateAccountPayload = (data) => {
  const required = [
    'accountId',
    'accountName',
    'email',
    'phone',
    'addressLine1',
    'city',
    'postalCode',
    'country',
    'lastbillingdate',
  ];

  const missing = required.filter((field) => !String(data[field] ?? '').trim());
  if (missing.length > 0) {
    return `Missing required fields: ${missing.join(', ')}`;
  }

  return null;
};

// =======================
// SEARCH / STATS ROUTES (FIRST)
// =======================

// Get account statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const stats = await Customer.findAll({
      attributes: [
        'accountRole',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('balance')), 'totalBalance'],
        [sequelize.fn('SUM', sequelize.col('creditLimit')), 'totalCreditLimit']
      ],
      group: ['accountRole']
    });

    const totalAccounts = await Customer.count();
    const activeAccounts = await Customer.count({ where: { active: true } });

    res.json({
      byRole: stats,
      totals: {
        totalAccounts,
        activeAccounts,
        inactiveAccounts: totalAccounts - activeAccounts
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Autocomplete search
router.get('/search/autocomplete', async (req, res) => {
  try {
    const { query, role } = req.query;

    if (!query || query.length < 2) {
      return res.json([]);
    }

    const where = {
      [Op.or]: [
        { accountName: { [Op.iLike]: `%${query}%` } },
        { email: { [Op.iLike]: `%${query}%` } },
        { customerCode: { [Op.iLike]: `%${query}%` } },
        { vendorCode: { [Op.iLike]: `%${query}%` } }
      ]
    };

    if (role) {
      where.accountRole = role;
    }

    const accounts = await Customer.findAll({
      where,
      limit: 10,
      attributes: [
        'id',
        'accountId',
        'accountName',
        'accountRole',
        'customerCode',
        'vendorCode',
        'email',
        'phone',
        'gatewayId'
      ],
      order: [['accountName', 'ASC']]
    });

    res.json(accounts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =======================
// LOOKUP ROUTES
// =======================

router.get('/lookup/:accountId', async (req, res) => {
  try {
    const account = await Customer.findOne({
      where: { accountId: req.params.accountId }
    });

    if (!account) return res.status(404).json({ error: 'Account not found' });
    res.json(account);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/customer/:customerCode', async (req, res) => {
  try {
    const account = await Customer.findOne({
      where: { customerCode: req.params.customerCode }
    });

    if (!account) return res.status(404).json({ error: 'Customer not found' });
    res.json(account);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/vendor/:vendorCode', async (req, res) => {
  try {
    const account = await Customer.findOne({
      where: { vendorCode: req.params.vendorCode }
    });

    if (!account) return res.status(404).json({ error: 'Vendor not found' });
    res.json(account);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =======================
// MAIN LIST API
// =======================

router.get('/', async (req, res) => {
  try {
    const { role, status, owner, search, query, page = 1, limit = 50 } = req.query;
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));

    const where = {};

    if (role && role !== 'all') {
      if (role === 'vendor') {
        where.accountRole = { [Op.in]: ['vendor', 'both'] };
      } else if (role === 'customer') {
        where.accountRole = { [Op.in]: ['customer', 'both'] };
      } else {
        where.accountRole = role;
      }
    }

    if (status && status !== 'all') {
      if (status === 'active') where.active = true;
      else if (status === 'inactive') where.active = false;
      else where.accountStatus = status;
    }

    if (owner && owner !== 'all') {
      const parsedOwner = parseInt(owner, 10);
      if (!Number.isNaN(parsedOwner)) {
        // Compare as text to handle deployments where accountOwner is varchar.
        where[Op.and] = [
          ...(where[Op.and] || []),
          Sequelize.where(
            Sequelize.cast(Sequelize.col('accountOwner'), 'TEXT'),
            String(parsedOwner)
          )
        ];
      }
    }

    const searchTerm = String(query ?? search ?? '').trim();
    if (searchTerm) {
      where.accountName = { [Op.iLike]: `%${searchTerm}%` };
    }

    const offset = (parsedPage - 1) * parsedLimit;

    // Fetch accounts first, then manually fetch owners to avoid type mismatch in JOIN
    const { count, rows } = await Customer.findAndCountAll({
      where,
      limit: parsedLimit,
      offset,
      order: [['createdAt', 'DESC']]
    });

    // Manually fetch and attach owner information
    const ownerIds = [...new Set(rows.filter(r => r.accountOwner).map(r => r.accountOwner))];
    const owners = ownerIds.length > 0 
      ? await User.findAll({
          where: { id: { [Op.in]: ownerIds } },
          attributes: ['id', 'first_name', 'last_name', 'email'],
          raw: true
        })
      : [];
    const ownerMap = {};
    owners.forEach(owner => {
      ownerMap[owner.id] = owner;
    });
    
    // Attach owners to rows
    rows.forEach(row => {
      row.owner = ownerMap[row.accountOwner] || null;
    });

    res.json({
      accounts: rows.map(r => ({
        ...r.toJSON ? r.toJSON() : r,
        owner: r.owner
      })),
      total: count,
      page: parsedPage,
      limit: parsedLimit,
      totalPages: Math.ceil(count / parsedLimit)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =======================
// SINGLE ACCOUNT (LAST)
// =======================

router.get('/:id', async (req, res) => {
  try {
    const accountId = parseInt(req.params.id);
    const account = await Customer.findByPk(accountId);
    
    // Manually fetch and attach owner
    if (account && account.accountOwner) {
      account.owner = await User.findByPk(account.accountOwner, {
        attributes: ['id', 'first_name', 'last_name', 'email']
      });
    } else {
      account.owner = null;
    }
    if (!account) return res.status(404).json({ error: 'Account not found' });
    res.json(account);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/documents', (req, res, next) => {
  accountDocUpload.single('file')(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: `File too large. Max allowed is ${accountDocMaxFileSizeMb}MB.` });
    }
    return res.status(400).json({ error: err.message || 'Invalid document upload request.' });
  });
}, async (req, res) => {
  try {
    const account = await Customer.findByPk(parseInt(req.params.id, 10));
    if (!account) {
      if (req.file?.path) await removeStoredFileSafe(req.file.path);
      return res.status(404).json({ error: 'Account not found' });
    }

    const title = String(req.body?.title || '').trim();
    if (!title) {
      if (req.file?.path) await removeStoredFileSafe(req.file.path);
      return res.status(400).json({ error: 'Document title is required' });
    }

    if (!req.file?.path) {
      return res.status(400).json({ error: 'Document file is required' });
    }

    const filePath = toStoredRelativePath(path.resolve(req.file.path));
    if (!filePath) {
      await removeStoredFileSafe(req.file.path);
      return res.status(400).json({ error: 'Invalid document storage path' });
    }

    const existingDocs = normalizeDocuments(account.documents);
    const newDoc = {
      id: crypto.randomUUID(),
      title,
      filePath,
      originalName: req.file.originalname,
      uploadedAt: new Date().toISOString(),
    };

    const documents = [...existingDocs, newDoc];
    await account.update({ documents });

    return res.status(201).json({ success: true, document: newDoc, documents });
  } catch (err) {
    if (req.file?.path) await removeStoredFileSafe(req.file.path);
    return res.status(400).json({ error: err.message });
  }
});

router.delete('/:id/documents/:documentId', async (req, res) => {
  try {
    const account = await Customer.findByPk(parseInt(req.params.id, 10));
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const documentId = String(req.params.documentId || '').trim();
    if (!documentId) return res.status(400).json({ error: 'Document id is required' });

    const existingDocs = normalizeDocuments(account.documents);
    const target = existingDocs.find((d) => d.id === documentId);
    if (!target) return res.status(404).json({ error: 'Document not found' });

    const documents = existingDocs.filter((d) => d.id !== documentId);
    await account.update({ documents });

    await removeStoredFileSafe(target.filePath);
    return res.status(200).json({ success: true, documents });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.get('/:id/documents/:documentId/download', async (req, res) => {
  try {
    const account = await Customer.findByPk(parseInt(req.params.id, 10));
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const documentId = String(req.params.documentId || '').trim();
    if (!documentId) return res.status(400).json({ error: 'Document id is required' });

    const existingDocs = normalizeDocuments(account.documents);
    const target = existingDocs.find((d) => d.id === documentId);
    if (!target) return res.status(404).json({ error: 'Document not found' });

    const resolvedPath = normalizeStoredPath(target.filePath);
    if (!resolvedPath) return res.status(400).json({ error: 'Invalid document path' });

    const fs = require('fs');
    const fileExists = await fs.promises.stat(resolvedPath).then(() => true).catch(() => false);
    if (!fileExists) return res.status(404).json({ error: 'Document file not found' });

    const fileName = target.originalName || target.filePath.split('/').pop();
    res.download(resolvedPath, fileName);
  } catch (err) {
    console.error('Error downloading document:', err.message);
    return res.status(400).json({ error: err.message });
  }
});

router.get('/:id/documents/:documentId/view', async (req, res) => {
  try {
    const account = await Customer.findByPk(parseInt(req.params.id, 10));
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const documentId = String(req.params.documentId || '').trim();
    if (!documentId) return res.status(400).json({ error: 'Document id is required' });

    const existingDocs = normalizeDocuments(account.documents);
    const target = existingDocs.find((d) => d.id === documentId);
    if (!target) return res.status(404).json({ error: 'Document not found' });

    const resolvedPath = normalizeStoredPath(target.filePath);
    if (!resolvedPath) return res.status(400).json({ error: 'Invalid document path' });

    const fs = require('fs');
    const fileExists = await fs.promises.stat(resolvedPath).then(() => true).catch(() => false);
    if (!fileExists) return res.status(404).json({ error: 'Document file not found' });

    const fileName = target.originalName || target.filePath.split('/').pop();
    res.sendFile(resolvedPath, { headers: { 'Content-Disposition': 'inline; filename="' + fileName + '"' } });
  } catch (err) {
    console.error('Error viewing document:', err.message);
    return res.status(400).json({ error: err.message });
  }
});

// Bulk create accounts
router.post('/bulk', async (req, res) => {
  const payload = req.body;
  const inputAccounts = Array.isArray(payload) ? payload : payload?.accounts;
  const continueOnError = Boolean(payload?.continueOnError);

  if (!Array.isArray(inputAccounts) || inputAccounts.length === 0) {
    return res.status(400).json({ error: 'accounts array is required' });
  }

  if (inputAccounts.length > 1000) {
    return res.status(400).json({ error: 'Maximum 1000 accounts per bulk request' });
  }

  const prepared = inputAccounts.map((raw) => {
    const data = normalizeAuthFields(normalizeContactChannels({ ...(raw || {}) }));
    if (Object.prototype.hasOwnProperty.call(data, 'documents')) {
      data.documents = normalizeDocuments(data.documents);
    }
    return applyBillingTypeAdjustments(data);
  });

  const errors = [];
  const created = [];

  const seenAccountIds = new Set();
  const seenEmails = new Set();

  prepared.forEach((data, index) => {
    const baseValidationError = validateAccountPayload(data);
    if (baseValidationError) {
      errors.push({ index, accountId: data.accountId || null, error: baseValidationError });
      return;
    }

    const normalizedAccountId = String(data.accountId).trim().toLowerCase();
    const normalizedEmail = String(data.email).trim().toLowerCase();

    if (seenAccountIds.has(normalizedAccountId)) {
      errors.push({ index, accountId: data.accountId, error: 'Duplicate accountId in request payload' });
      return;
    }
    if (seenEmails.has(normalizedEmail)) {
      errors.push({ index, accountId: data.accountId, error: 'Duplicate email in request payload' });
      return;
    }

    seenAccountIds.add(normalizedAccountId);
    seenEmails.add(normalizedEmail);
  });

  if (!continueOnError && errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Bulk validation failed',
      createdCount: 0,
      failedCount: errors.length,
      errors,
    });
  }

  const validRows = prepared
    .map((data, index) => ({ data, index }))
    .filter(({ index }) => !errors.some((e) => e.index === index));

  if (!continueOnError) {
    const transaction = await sequelize.transaction();
    try {
      for (const row of validRows) {
        const account = await Customer.create(row.data, { transaction });
        created.push({ index: row.index, id: account.id, accountId: account.accountId, accountName: account.accountName });
      }
      await transaction.commit();

      return res.status(201).json({
        success: true,
        createdCount: created.length,
        failedCount: 0,
        created,
        errors: [],
      });
    } catch (err) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Bulk create failed. No accounts were created.',
        createdCount: 0,
        failedCount: validRows.length,
        errors: [{ error: err.message }],
      });
    }
  }

  for (const row of validRows) {
    try {
      const account = await Customer.create(row.data);
      created.push({ index: row.index, id: account.id, accountId: account.accountId, accountName: account.accountName });
    } catch (err) {
      errors.push({ index: row.index, accountId: row.data.accountId || null, error: err.message });
    }
  }

  return res.status(201).json({
    success: true,
    createdCount: created.length,
    failedCount: errors.length,
    created,
    errors,
  });
});

// Create new account
router.post('/', async (req, res) => {
  try {
    const data = normalizeAuthFields(normalizeContactChannels({ ...req.body }));
    if (Object.prototype.hasOwnProperty.call(data, 'documents')) {
      data.documents = normalizeDocuments(data.documents);
    }

    applyBillingTypeAdjustments(data);

    let account = await Customer.create(data);
    // reload to include owner info
    account = await Customer.findByPk(account.id);
    if (account && account.accountOwner) {
      account.owner = await User.findByPk(account.accountOwner, {
        attributes: ['id', 'first_name', 'last_name', 'email']
      });
    } else {
      account.owner = null;
    }
    res.status(201).json(account.toJSON ? account.toJSON() : account);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update account
router.put('/:id', async (req, res) => {
  try {
    const account = await Customer.findByPk(parseInt(req.params.id));
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const updates = normalizeAuthFields(normalizeContactChannels({ ...req.body }));
    if (Object.prototype.hasOwnProperty.call(updates, 'documents')) {
      updates.documents = normalizeDocuments(updates.documents);
    }

    // if billing type is changing, clear/seed appropriate fields
    if (updates.billingType && updates.billingType !== account.billingType) {
      if (updates.billingType === 'prepaid') {
        updates.creditLimit = 0;
        updates.originalCreditLimit = 0;
        // maybe keep existing balance
      } else if (updates.billingType === 'postpaid') {
        updates.balance = 0;
        if (updates.creditLimit != null) {
          updates.originalCreditLimit = updates.creditLimit;
        } else {
          // if no new limit supplied, keep old-credit as original
          updates.originalCreditLimit = account.creditLimit;
        }
      }
    }

    // otherwise just update originalCreditLimit when limit changes on postpaid
    if (updates.creditLimit != null && account.billingType === 'postpaid') {
      updates.originalCreditLimit = updates.creditLimit;
    }

    // recalc nextBilling if last or cycle changed
    const computeNext2 = (last, cycle) => {
      const dt = new Date(last);
      switch (cycle) {
        case 'daily': dt.setDate(dt.getDate() + 1); break;
        case 'weekly': dt.setDate(dt.getDate() + 7); break;
        case 'monthly': dt.setMonth(dt.getMonth() + 1); break;
        case 'quarterly': dt.setMonth(dt.getMonth() + 3); break;
        case 'annually': dt.setFullYear(dt.getFullYear() + 1); break;
        default: break;
      }
      return dt.toISOString().split('T')[0];
    };
    if (updates.lastbillingdate && updates.billingCycle) {
      updates.nextbillingdate = computeNext2(updates.lastbillingdate, updates.billingCycle);
    }

    await account.update(updates);
    // reload with owner
    const updated = await Customer.findByPk(account.id);
    if (updated && updated.accountOwner) {
      updated.owner = await User.findByPk(updated.accountOwner, {
        attributes: ['id', 'first_name', 'last_name', 'email']
      });
    } else {
      updated.owner = null;
    }
    res.json(updated.toJSON ? updated.toJSON() : updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete account
router.delete('/:id', async (req, res) => {
  try {
    const account = await Customer.findByPk(parseInt(req.params.id));
    if (!account) return res.status(404).json({ error: 'Account not found' });
    await account.destroy();
    res.json({ message: 'Account deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
