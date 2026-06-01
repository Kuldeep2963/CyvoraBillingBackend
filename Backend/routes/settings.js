const express = require('express');
const router = express.Router();
const multer = require('multer');
const Papa = require('papaparse');
const { Op } = require('sequelize');
const {
  getGlobalSettings,
  updateGlobalSettings,
  getBillingClassProfiles,
  getBillingClassProfile,
  upsertBillingClassProfile,
} = require('../services/system-settings');
const { createNotification } = require('../services/notification-service');
const EmailService = require('../services/EmailService');
const CDRRetentionService = require('../services/cdr-retention-service');
const CountryCode = require('../models/CountryCode');
const Account = require('../models/Account');
const SystemSetting = require('../models/SystemSetting');
const sequelize = require('../models/db');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const isCsv = file.mimetype === 'text/csv' || file.originalname.toLowerCase().endsWith('.csv');
    if (!isCsv) {
      return cb(new Error('Only CSV files are allowed'));
    }
    cb(null, true);
  },
});

const handleCountryCodeUpload = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    return next();
  });
};

const normalizeHeader = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, '_');

const parseBoolean = (value, defaultValue = false) => {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = String(value).trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(normalized);
};

const toCountryCodeRows = (rawRows) => {
  if (!Array.isArray(rawRows) || rawRows.length === 0) {
    return [];
  }

  const firstRow = Array.isArray(rawRows[0]) ? rawRows[0] : [];
  const normalizedHeaders = firstRow.map(normalizeHeader);

  const hasHeader = normalizedHeaders.includes('code') ||
    normalizedHeaders.includes('country_name') ||
    normalizedHeaders.includes('country');

  const rows = hasHeader ? rawRows.slice(1) : rawRows;
  const codeIndex = hasHeader ? normalizedHeaders.findIndex((header) => header === 'code') : 0;
  const countryIndex = hasHeader
    ? normalizedHeaders.findIndex((header) => ['country_name', 'country', 'countryname'].includes(header))
    : 1;

  const entries = [];

  for (const row of rows) {
    if (!Array.isArray(row)) {
      continue;
    }

    const codeRaw = codeIndex >= 0 ? row[codeIndex] : row[0];
    const countryRaw = countryIndex >= 0 ? row[countryIndex] : row[1];
    const code = String(codeRaw || '').trim();
    const countryName = String(countryRaw || '').trim();

    if (!code && !countryName) {
      continue;
    }

    if (!code || !countryName) {
      throw new Error('Each CSV row must include both code and country_name');
    }

    entries.push({
      code,
      country_name: countryName,
    });
  }

  if (entries.length === 0) {
    throw new Error('No valid country code records found in uploaded CSV');
  }

  const uniqueByCode = new Map();

  for (const entry of entries) {
    // Keep the last occurrence from the CSV for deterministic overwrite behavior.
    uniqueByCode.set(entry.code, entry);
  }

  return Array.from(uniqueByCode.values());
};

router.get('/', async (_req, res) => {
  try {
    const settings = await getGlobalSettings();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/', async (req, res) => {
  try {
    const role = req.user?.role?.toLowerCase();
    if (role !== 'admin') {
      return res.status(403).json({ error: 'Only admin can update settings' });
    }

    const settings = await updateGlobalSettings(req.body || {}, req.user?.email);

    await createNotification({
      title: 'Settings updated',
      message: `Global settings were updated by ${req.user?.email || 'admin'}.`,
      type: 'info',
      category: 'settings',
    });

    res.json(settings);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/billing-classes', async (_req, res) => {
  try {
    const billingClasses = await getBillingClassProfiles();
    return res.json({ billingClasses });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/billing-classes/:tag', async (req, res) => {
  try {
    const tag = String(req.params?.tag || '').trim().toLowerCase();
    if (!tag) {
      return res.status(400).json({ error: 'Billing class tag is required' });
    }

    const billingClass = await getBillingClassProfile(tag);
    if (!billingClass) {
      return res.status(404).json({ error: `Billing class profile not found for tag: ${tag}` });
    }
    return res.json({ billingClass });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

router.put('/billing-classes/:tag', async (req, res) => {
  try {
    const role = req.user?.role?.toLowerCase();
    if (role !== 'admin') {
      return res.status(403).json({ error: 'Only admin can update billing class settings' });
    }

    const tag = String(req.params?.tag || '').trim().toLowerCase();
    if (!tag) {
      return res.status(400).json({ error: 'Billing class tag is required' });
    }

    const billingClass = await upsertBillingClassProfile(tag, req.body || {}, req.user?.email);

    return res.json({
      message: `Billing class ${tag} updated successfully`,
      billingClass,
    });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

router.delete('/billing-classes/:tag', async (req, res) => {
  try {
    const role = req.user?.role?.toLowerCase();
    if (role !== 'admin') {
      return res.status(403).json({ error: 'Only admin can delete billing class settings' });
    }

    const tag = String(req.params?.tag || '').trim().toLowerCase();
    if (!tag) {
      return res.status(400).json({ error: 'Billing class tag is required' });
    }

    const billingClass = await getBillingClassProfile(tag);
    if (!billingClass) {
      return res.status(404).json({ error: `Billing class profile not found for tag: ${tag}` });
    }

    const accountCount = await Account.count({ where: { billingClass: tag } });
    const reassignToRaw = String(req.body?.reassignTo || '').trim().toLowerCase();

    if (accountCount > 0 && !reassignToRaw) {
      return res.status(409).json({
        error: `Billing class ${tag} is assigned to ${accountCount} account(s). Reassign them before deleting.`,
        accountCount,
        requiresReassignment: true,
      });
    }

    let reassignedAccounts = 0;

    await sequelize.transaction(async (transaction) => {
      if (accountCount > 0) {
        if (reassignToRaw === tag) {
          throw new Error('Replacement billing class must be different from the billing class being deleted');
        }

        const replacement = await getBillingClassProfile(reassignToRaw);
        if (!replacement) {
          throw new Error(`Replacement billing class profile not found for tag: ${reassignToRaw}`);
        }

        const [updatedCount] = await Account.update(
          { billingClass: reassignToRaw },
          { where: { billingClass: tag }, transaction },
        );
        reassignedAccounts = Number(updatedCount || 0);
      }

      await SystemSetting.destroy({
        where: { key: tag },
        transaction,
      });
    });

    await createNotification({
      title: 'Billing class deleted',
      message: reassignedAccounts > 0
        ? `Billing class ${tag} deleted and ${reassignedAccounts} account(s) reassigned to ${reassignToRaw}.`
        : `Billing class ${tag} deleted by ${req.user?.email || 'admin'}.`,
      type: 'warning',
      category: 'settings',
    });

    return res.json({
      message: `Billing class ${tag} deleted successfully`,
      deletedTag: tag,
      reassignedTo: reassignedAccounts > 0 ? reassignToRaw : null,
      reassignedAccounts,
    });
  } catch (error) {
    const status = error.message?.includes('Replacement billing class') ? 400 : 400;
    return res.status(status).json({ error: error.message });
  }
});

router.post('/retention/run', async (req, res) => {
  try {
    const role = req.user?.role?.toLowerCase();
    if (role !== 'admin') {
      return res.status(403).json({ error: 'Only admin can run retention cleanup' });
    }

    const service = new CDRRetentionService();
    const result = await service.runCleanup({ trigger: 'manual', force: true });
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/country-codes/upload', handleCountryCodeUpload, async (req, res) => {
  try {
    const role = req.user?.role?.toLowerCase();
    if (role !== 'admin') {
      return res.status(403).json({ error: 'Only admin can upload country codes' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No CSV file uploaded' });
    }

    const parsed = Papa.parse(req.file.buffer.toString('utf8'), {
      header: false,
      skipEmptyLines: true,
    });

    if (Array.isArray(parsed.errors) && parsed.errors.length > 0) {
      return res.status(400).json({ error: `CSV parse error: ${parsed.errors[0].message}` });
    }

    const rows = toCountryCodeRows(parsed.data || []);
    const replaceExisting = parseBoolean(req.body?.replaceExisting, false);

    const summary = await sequelize.transaction(async (transaction) => {
      let deletedCount = 0;

      if (replaceExisting) {
        deletedCount = await CountryCode.destroy({
          where: {},
          truncate: true,
          transaction,
        });
      }

      await CountryCode.bulkCreate(rows, {
        updateOnDuplicate: ['country_name'],
        transaction,
      });

      return {
        deletedCount: Number(deletedCount) || 0,
        uploadedCount: rows.length,
      };
    });

    await createNotification({
      title: 'Country codes uploaded',
      message: `${summary.uploadedCount} country codes uploaded by ${req.user?.email || 'admin'}.`,
      type: 'success',
      category: 'settings',
    });

    return res.json({
      message: 'Country codes uploaded successfully',
      ...summary,
      replaceExisting,
    });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

router.get('/country-codes', async (req, res) => {
  try {
    const search = String(req.query?.search || '').trim();
    const parsedPage = Number(req.query?.page);
    const page = Number.isFinite(parsedPage) && parsedPage > 0
      ? Math.floor(parsedPage)
      : 1;
    const parsedLimit = Number(req.query?.limit);
    const limit = Number.isFinite(parsedLimit) && parsedLimit > 0
      ? Math.min(parsedLimit, 100)
      : 50;
    const offset = (page - 1) * limit;

    const where = search
      ? {
          [Op.or]: [
            { code: { [Op.iLike]: `${search}%` } },
            { country_name: { [Op.iLike]: `${search}%` } },
          ],
        }
      : undefined;

    const { rows, count } = await CountryCode.findAndCountAll({
      attributes: ['code', 'country_name'],
      where,
      order: [
        ['country_name', 'ASC'],
        ['code', 'ASC'],
      ],
      limit,
      offset,
      raw: true,
    });

    const total = Number(count) || 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    return res.json({
      countryCodes: rows,
      total,
      page,
      limit,
      totalPages,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/country-codes', async (req, res) => {
  try {
    const role = req.user?.role?.toLowerCase();
    if (role !== 'admin') {
      return res.status(403).json({ error: 'Only admin can add country codes' });
    }

    const code = String(req.body?.code || '').trim();
    const countryName = String(req.body?.country_name || '').trim();

    if (!code || !countryName) {
      return res.status(400).json({ error: 'Both code and country_name are required' });
    }

    const existing = await CountryCode.findByPk(code);
    let record;

    if (existing) {
      existing.country_name = countryName;
      await existing.save();
      record = existing;
    } else {
      record = await CountryCode.create({
        code,
        country_name: countryName,
      });
    }

    await createNotification({
      title: existing ? 'Country code updated' : 'Country code added',
      message: `${code} - ${countryName} saved by ${req.user?.email || 'admin'}.`,
      type: 'success',
      category: 'settings',
    });

    return res.status(existing ? 200 : 201).json({
      message: existing ? 'Country code updated successfully' : 'Country code added successfully',
      countryCode: {
        code: record.code,
        country_name: record.country_name,
      },
      updated: Boolean(existing),
    });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

// Send a test email using a selected SMTP profile
router.post('/test-email', async (req, res) => {
  try {
    const role = req.user?.role?.toLowerCase();
    if (role !== 'admin') {
      return res.status(403).json({ error: 'Only admin can send test emails' });
    }

    const profile = String(req.body?.profile || 'management').trim();
    const to = String(req.body?.to || '').trim();
    const format = String(req.body?.format || 'template').trim().toLowerCase();

    if (!to) {
      return res.status(400).json({ error: 'Recipient email (to) is required' });
    }

    // If caller requested a minimal plain-text SMTP check, send a stripped-down message
    if (format === 'simple') {
      try {
        const { transporter, fromAddress, smtpUser, host, port } = await EmailService.createTransporter(profile);
        const text = [
          'SMTP connected',
          `Profile: ${profile}`,
          `Host: ${host}`,
          `Port: ${port}`,
          `User: ${smtpUser || fromAddress}`,
        ].join('\n');

        await transporter.sendMail({
          from: fromAddress,
          to,
          subject: 'CDR Billing — SMTP Test (simple)',
          text,
          envelope: {
            from: smtpUser || fromAddress,
            to: [to],
          },
        });

        return res.json({ message: 'SMTP simple test email sent' });
      } catch (err) {
        return res.status(400).json({ error: err?.message || String(err) });
      }
    }

    // Prepare template data for a diagnostic test-email template.
    // We resolve transporter info so the template can show host/port/user.
    let smtpInfo;
    try {
      smtpInfo = await EmailService.createTransporter(profile);
    } catch (err) {
      return res.status(400).json({ error: `SMTP profile "${profile}" not configured: ${err?.message || String(err)}` });
    }

    const { smtpUser, host, port } = smtpInfo;

    const templateData = {
      firstName: 'Test',
      lastName: 'User',
      to,
      message: 'SMTP connected',
      role: 'tester',
      phone: '',
      profile,
      smtpUser,
      host,
      port,
      portalUrl: process.env.FRONTEND_URL || '/',
      details: null,
    };

    await EmailService.sendEmail(to, 'CDR Billing — SMTP Test', 'test-email', templateData, [], profile);

    return res.json({ message: 'Test email queued/sent' });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

router.delete('/country-codes/:code', async (req, res) => {
  try {
    const role = req.user?.role?.toLowerCase();
    if (role !== 'admin') {
      return res.status(403).json({ error: 'Only admin can delete country codes' });
    }

    const code = String(req.params?.code || '').trim();
    if (!code) {
      return res.status(400).json({ error: 'Country code is required' });
    }

    const existing = await CountryCode.findByPk(code);
    if (!existing) {
      return res.status(404).json({ error: 'Country code not found' });
    }

    await existing.destroy();

    await createNotification({
      title: 'Country code deleted',
      message: `${code} - ${existing.country_name} deleted by ${req.user?.email || 'admin'}.`,
      type: 'warning',
      category: 'settings',
    });

    return res.json({
      message: 'Country code deleted successfully',
      code,
    });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

module.exports = router;
