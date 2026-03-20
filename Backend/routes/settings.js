const express = require('express');
const router = express.Router();
const multer = require('multer');
const Papa = require('papaparse');
const { getGlobalSettings, updateGlobalSettings } = require('../services/system-settings');
const { createNotification } = require('../services/notification-service');
const CDRRetentionService = require('../services/cdr-retention-service');
const CountryCode = require('../models/CountryCode');
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

  return entries;
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

router.post('/retention/run', async (req, res) => {
  try {
    const role = req.user?.role?.toLowerCase();
    if (role !== 'admin') {
      return res.status(403).json({ error: 'Only admin can run retention cleanup' });
    }

    const service = new CDRRetentionService();
    const result = await service.runCleanup();
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

router.get('/country-codes', async (_req, res) => {
  try {
    const countryCodes = await CountryCode.findAll({
      attributes: ['code', 'country_name'],
      order: [
        ['country_name', 'ASC'],
        ['code', 'ASC'],
      ],
      raw: true,
    });

    return res.json({
      countryCodes,
      total: countryCodes.length,
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
