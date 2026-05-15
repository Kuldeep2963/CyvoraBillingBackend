const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const sequelize = require('../models/db');
const CDR = require('../models/CDR');
const Account = require('../models/Account');
const { createNotification } = require('../services/notification-service');

const trimmedEq = (column, value) =>
  sequelize.where(sequelize.fn('TRIM', sequelize.col(column)), { [Op.eq]: String(value).trim() });

const normalizeAuthType = (value) => {
  const v = String(value || '').trim().toLowerCase();
  return v === 'ip' || v === 'custom' ? v : null;
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

const buildConditionsFromAuth = (account, vendorSide = false) => {
  const or = [];

  const authType = normalizeAuthType(
    vendorSide ? account.vendorauthenticationType : account.customerauthenticationType
  );
  const authValues = normalizeAuthValues(
    vendorSide ? account.vendorauthenticationValue : account.customerauthenticationValue
  );

  if (authType === 'ip' && authValues.length > 0) {
    authValues.forEach((value) => {
      or.push(trimmedEq(vendorSide ? 'calleeip' : 'callerip', value));
    });
  }

  if (authType === 'custom' && authValues.length > 0) {
    authValues.forEach((value) => {
      const v = String(value).trim();
      if (!v) return;
      if (vendorSide) {
        or.push(trimmedEq('agentaccount', v));
        or.push(trimmedEq('agentname', v));
      } else {
        or.push(trimmedEq('customeraccount', v));
        or.push(trimmedEq('customername', v));
      }
    });
  }

  // Legacy fallback when auth is not configured.
  if (or.length === 0 && authType !== 'ip' && authType !== 'custom') {
    if (vendorSide) {
      const vCode = account.vendorCode || account.gatewayId;
      if (vCode) or.push(trimmedEq('agentaccount', vCode));
    } else {
      const cCode = account.customerCode || account.gatewayId;
      if (cCode) or.push(trimmedEq('customeraccount', cCode));
    }
  }

  return or;
};

const normalizeRole = (role) => String(role || '').trim().toLowerCase().replace(/[\s_]+/g, '-');
const normalizeCdrSide = (side) => {
  const v = String(side || 'all').trim().toLowerCase();
  if (v === 'customer' || v === 'vendor' || v === 'all') return v;
  return null;
};

const toCsvValue = (value) => {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const unknownCustomerConditionSql = (alias) => `
  NOT EXISTS (
    SELECT 1
    FROM accounts a
    WHERE a.active = true
      AND COALESCE(a."accountRole", 'customer') IN ('customer', 'both')
      AND (
        (
          a."customerauthenticationType" = 'ip'
          AND EXISTS (
            SELECT 1
            FROM regexp_split_to_table(
              regexp_replace(
                COALESCE(a."customerauthenticationValue"::text, ''),
                '(^\\s*\\[|\\]\\s*$)',
                '',
                'g'
              ),
              '\\s*,\\s*'
            ) AS auth(v)
            WHERE NULLIF(BTRIM(auth.v, ' "'), '') IS NOT NULL
              AND TRIM(COALESCE(${alias}."callerip"::text, '')) = BTRIM(auth.v, ' "')
          )
        )
        OR
        (
          a."customerauthenticationType" = 'custom'
          AND EXISTS (
            SELECT 1
            FROM regexp_split_to_table(
              regexp_replace(
                COALESCE(a."customerauthenticationValue"::text, ''),
                '(^\\s*\\[|\\]\\s*$)',
                '',
                'g'
              ),
              '\\s*,\\s*'
            ) AS auth(v)
            WHERE NULLIF(BTRIM(auth.v, ' "'), '') IS NOT NULL
              AND (
                TRIM(COALESCE(${alias}."customeraccount"::text, '')) = BTRIM(auth.v, ' "')
                OR TRIM(COALESCE(${alias}."customername"::text, '')) = BTRIM(auth.v, ' "')
              )
          )
        )
        OR
        (
          COALESCE(a."customerauthenticationType"::text, '') NOT IN ('ip', 'custom')
          AND (
            (
              NULLIF(TRIM(COALESCE(a."customerCode"::text, '')), '') IS NOT NULL
              AND TRIM(COALESCE(${alias}."customeraccount"::text, '')) = TRIM(a."customerCode"::text)
            )
            OR
            (
              NULLIF(TRIM(COALESCE(a."gatewayId"::text, '')), '') IS NOT NULL
              AND TRIM(COALESCE(${alias}."customeraccount"::text, '')) = TRIM(a."gatewayId"::text)
            )
          )
        )
      )
  )
`;

// Get CDR total count (fast and memory-safe for dashboards/settings)
router.get('/count', async (_req, res) => {
  try {
    const count = await CDR.count();
    res.json({ count });
  } catch (err) {
    console.error('CDR stats query failed:', err.message);
    // Fail-safe for dashboard/account UI: malformed legacy CDR values should not break stats cards.
    return res.json({
      totalCalls: 0,
      totalDuration: 0,
      totalRevenue: 0,
      totalTax: 0,
      answeredCalls: 0,
      degraded: true,
    });
  }
});

// Get aggregate CDR stats for a customer/vendor mapping without returning full row sets
router.get('/stats', async (req, res) => {
  try {
    const accountId = String(req.query.accountId || '').trim();
    const customerCode = String(req.query.customerCode || '').trim();
    const vendorCode = String(req.query.vendorCode || '').trim();

    if (!accountId && !customerCode && !vendorCode) {
      return res.status(400).json({ error: 'accountId, customerCode, or vendorCode is required' });
    }

    let account = null;

    if (accountId) {
      if (!Number.isNaN(Number(accountId))) {
        account = await Account.findByPk(Number(accountId));
      }

      if (!account) {
        account = await Account.findOne({
          where: {
            [Op.or]: [
              { accountId },
              { customerCode: accountId },
              { vendorCode: accountId },
            ],
          },
        });
      }
    }

    if (!account && (customerCode || vendorCode)) {
      account = await Account.findOne({
        where: {
          [Op.or]: [
            customerCode ? { customerCode } : null,
            vendorCode ? { vendorCode } : null,
          ].filter(Boolean),
        },
      });
    }

    const where = {
      [Op.or]: [],
    };

    if (account) {
      const role = account.accountRole || 'customer';

      if (role === 'customer' || role === 'both') {
        where[Op.or].push(...buildConditionsFromAuth(account, false));
      }
      if (role === 'vendor' || role === 'both') {
        where[Op.or].push(...buildConditionsFromAuth(account, true));
      }
    } else {
      // Backward-compatible fallback if account cannot be resolved.
      if (customerCode) {
        where[Op.or].push(trimmedEq('customeraccount', customerCode));
      }
      if (vendorCode) {
        where[Op.or].push(trimmedEq('agentaccount', vendorCode));
      }
    }

    if (where[Op.or].length === 0) {
      return res.json({
        totalCalls: 0,
        totalDuration: 0,
        totalRevenue: 0,
        totalTax: 0,
        answeredCalls: 0,
      });
    }

    const [result] = await CDR.findAll({
      where,
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'totalCalls'],
        [sequelize.literal(`
          COALESCE(SUM(
            CASE
              WHEN regexp_replace(COALESCE(feetime, ''), '[^0-9eE+\\-.]', '', 'g') ~ '^[+-]?(?:[0-9]+(?:\\.[0-9]*)?|\\.[0-9]+)(?:[eE][+-]?[0-9]+)?$'
              THEN regexp_replace(COALESCE(feetime, ''), '[^0-9eE+\\-.]', '', 'g')::double precision
              ELSE 0
            END
          ), 0)
        `), 'totalDuration'],
        [sequelize.literal(`
          COALESCE(SUM(
            CASE
              WHEN regexp_replace(COALESCE(fee, ''), '[^0-9eE+\\-.]', '', 'g') ~ '^[+-]?(?:[0-9]+(?:\\.[0-9]*)?|\\.[0-9]+)(?:[eE][+-]?[0-9]+)?$'
              THEN regexp_replace(COALESCE(fee, ''), '[^0-9eE+\\-.]', '', 'g')::double precision
              ELSE 0
            END
          ), 0)
        `), 'totalRevenue'],
        [sequelize.literal(`
          COALESCE(SUM(
            CASE
              WHEN regexp_replace(COALESCE(tax, ''), '[^0-9eE+\\-.]', '', 'g') ~ '^[+-]?(?:[0-9]+(?:\\.[0-9]*)?|\\.[0-9]+)(?:[eE][+-]?[0-9]+)?$'
              THEN regexp_replace(COALESCE(tax, ''), '[^0-9eE+\\-.]', '', 'g')::double precision
              ELSE 0
            END
          ), 0)
        `), 'totalTax'],
        [sequelize.literal(`
          COALESCE(SUM(
            CASE
              WHEN regexp_replace(COALESCE(endreason, ''), '[^0-9\\-]', '', 'g') ~ '^-?[0-9]+$'
                AND regexp_replace(COALESCE(endreason, ''), '[^0-9\\-]', '', 'g')::integer = 0
              THEN 1
              ELSE 0
            END
          ), 0)
        `), 'answeredCalls'],
      ],
      raw: true,
    });

    res.json({
      totalCalls: Number(result?.totalCalls || 0),
      totalDuration: Number(result?.totalDuration || 0),
      totalRevenue: Number(result?.totalRevenue || 0),
      totalTax: Number(result?.totalTax || 0),
      answeredCalls: Number(result?.answeredCalls || 0),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Download CDRs as CSV for a given time period (admin only)
router.get('/export', async (req, res) => {
  try {
    if (normalizeRole(req.user?.role) !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const accountId = String(req.query.accountId || '').trim();
    const cdrSide = normalizeCdrSide(req.query.cdrSide);
    const startTime = String(req.query.startTime || '').trim();
    const endTime = String(req.query.endTime || '').trim();

    if (!cdrSide) {
      return res.status(400).json({ error: 'cdrSide must be one of: all, customer, vendor' });
    }

    if (!startTime || !endTime) {
      return res.status(400).json({ error: 'startTime and endTime are required' });
    }

    const startTs = Number(new Date(startTime).getTime());
    const endTs = Number(new Date(endTime).getTime());

    if (!Number.isFinite(startTs) || !Number.isFinite(endTs)) {
      return res.status(400).json({ error: 'Invalid startTime or endTime' });
    }

    if (startTs > endTs) {
      return res.status(400).json({ error: 'startTime cannot be greater than endTime' });
    }

    const where = {
      [Op.and]: [
        sequelize.literal(
          `CASE WHEN "CDR"."starttime"::text ~ '^[0-9]+$' THEN "CDR"."starttime"::bigint ELSE NULL END BETWEEN ${Math.trunc(startTs)} AND ${Math.trunc(endTs)}`
        ),
      ],
    };

    if (cdrSide === 'customer') {
      where[Op.and].push(
        sequelize.literal("NULLIF(TRIM(COALESCE(\"CDR\".\"customeraccount\", '')), '') IS NOT NULL")
      );
    }

    if (cdrSide === 'vendor') {
      where[Op.and].push(
        sequelize.literal("NULLIF(TRIM(COALESCE(\"CDR\".\"agentaccount\", '')), '') IS NOT NULL")
      );
    }

    if (accountId && accountId !== 'all') {
      let account = null;

      if (!Number.isNaN(Number(accountId))) {
        account = await Account.findByPk(Number(accountId));
      }

      if (!account) {
        account = await Account.findOne({
          where: {
            [Op.or]: [
              { accountId },
              { customerCode: accountId },
              { vendorCode: accountId },
            ],
          },
        });
      }

      if (!account) {
        return res.status(404).json({ error: 'Account not found for accountId' });
      }

      const accountConditions = [];
      const role = account.accountRole || 'customer';

      if ((role === 'customer' || role === 'both') && cdrSide !== 'vendor') {
        accountConditions.push(...buildConditionsFromAuth(account, false));
      }
      if ((role === 'vendor' || role === 'both') && cdrSide !== 'customer') {
        accountConditions.push(...buildConditionsFromAuth(account, true));
      }

      if (accountConditions.length === 0) {
        return res.status(400).json({ error: 'No valid CDR mapping found for selected account' });
      }

      where[Op.and].push({ [Op.or]: accountConditions });
    }

    const excludedColumns = new Set(['id', 'source_file', 'createdAt', 'updatedAt']);
    const attributes = Object.keys(CDR.rawAttributes).filter((column) => !excludedColumns.has(column));
    const fileStart = new Date(startTs).toISOString().replace(/[:.]/g, '-');
    const fileEnd = new Date(endTs).toISOString().replace(/[:.]/g, '-');
    const fileName = `cdrs_${fileStart}_to_${fileEnd}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Cache-Control', 'no-store');

    let isClosed = false;
    req.on('close', () => {
      isClosed = true;
    });

    res.write(`${attributes.join(',')}\n`);

    const limit = 5000;
    let offset = 0;

    while (!isClosed) {
      const rows = await CDR.findAll({
        where,
        attributes,
        order: [['id', 'ASC']],
        limit,
        offset,
        raw: true,
      });

      if (!rows.length) break;

      for (const row of rows) {
        if (isClosed) break;
        const line = attributes.map((key) => toCsvValue(row[key])).join(',');
        res.write(`${line}\n`);
      }

      offset += rows.length;
    }

    if (!isClosed && !res.writableEnded) {
      res.end();
    }
  } catch (err) {
    if (!res.headersSent) {
      return res.status(500).json({ error: err.message });
    }
    if (!res.writableEnded) {
      res.end();
    }
  }
});

// Missing gateways: CDRs that do not match any known customer mapping
router.get('/missing-gateways', async (req, res) => {
  try {
    const startDate = String(req.query.startDate || '').trim();
    const endDate = String(req.query.endDate || '').trim();
    const search = String(req.query.search || '').trim();
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Math.min(200, Number(req.query.limit) || 25));
    const offset = (page - 1) * limit;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    const startTs = Number(new Date(`${startDate}T00:00:00.000Z`).getTime());
    const endTs = Number(new Date(`${endDate}T23:59:59.999Z`).getTime());

    if (!Number.isFinite(startTs) || !Number.isFinite(endTs)) {
      return res.status(400).json({ error: 'Invalid startDate or endDate' });
    }

    if (startTs > endTs) {
      return res.status(400).json({ error: 'startDate cannot be greater than endDate' });
    }

    const unknownCondition = unknownCustomerConditionSql('"CDR"');
    const where = {
      [Op.and]: [
        sequelize.literal(
          `CASE WHEN "CDR"."starttime"::text ~ '^[0-9]+$' THEN "CDR"."starttime"::bigint ELSE NULL END BETWEEN ${Math.trunc(startTs)} AND ${Math.trunc(endTs)}`
        ),
        sequelize.literal(unknownCondition),
      ],
    };

    if (search) {
      const q = search.replace(/'/g, "''");
      where[Op.and].push(
        sequelize.literal(`
          (
            COALESCE("CDR"."callergatewayid"::text, '') ILIKE '%${q}%'
            OR COALESCE("CDR"."callerip"::text, '') ILIKE '%${q}%'
            OR COALESCE("CDR"."customeraccount"::text, '') ILIKE '%${q}%'
            OR COALESCE("CDR"."customername"::text, '') ILIKE '%${q}%'
            OR COALESCE("CDR"."callere164"::text, '') ILIKE '%${q}%'
            OR COALESCE("CDR"."calleee164"::text, '') ILIKE '%${q}%'
          )
        `)
      );
    }

    const startTimeExpression = `CASE WHEN "CDR"."starttime"::text ~ '^[0-9]+$' THEN "CDR"."starttime"::bigint ELSE NULL END`;
    const gatewayExpression = `COALESCE(NULLIF(TRIM("CDR"."callerip"::text), ''), NULLIF(TRIM("CDR"."callergatewayid"::text), ''), 'unknown')`;
    const safeFeeExpression = `COALESCE(SUM(
      CASE
        WHEN regexp_replace(COALESCE("CDR"."feetime"::text, ''), '[^0-9eE+\\-.]', '', 'g') ~ '^[+-]?(?:[0-9]+(?:\\.[0-9]*)?|\\.[0-9]+)(?:[eE][+-]?[0-9]+)?$'
        THEN regexp_replace(COALESCE("CDR"."feetime"::text, ''), '[^0-9eE+\\-.]', '', 'g')::double precision
        ELSE 0
      END
    ), 0)`;

    const groupedRows = await CDR.findAll({
      where,
      attributes: [
        [sequelize.literal(gatewayExpression), 'gateway'],
        [sequelize.fn('MIN', sequelize.col('callerip')), 'callerip'],
        [sequelize.fn('MIN', sequelize.col('customeraccount')), 'customeraccount'],
        [sequelize.fn('MIN', sequelize.col('customername')), 'customername'],
        [sequelize.fn('MIN', sequelize.col('callere164')), 'cli'],
        [sequelize.fn('MIN', sequelize.col('calleee164')), 'called'],
        [sequelize.literal('COUNT(*)'), 'occurrences'],
        [sequelize.literal(safeFeeExpression), 'duration'],
        [sequelize.literal(`MIN(${startTimeExpression})`), 'firstSeen'],
        [sequelize.literal(`MAX(${startTimeExpression})`), 'lastSeen'],
      ],
      group: [sequelize.literal(gatewayExpression)],
      raw: true,
    });

    const normalizedRows = groupedRows
      .map((row) => ({
        id: row.gateway,
        gateway: row.gateway || 'unknown',
        callerip: row.callerip || row.gateway || '',
        customeraccount: row.customeraccount || '',
        customername: row.customername || '',
        cli: row.cli || '',
        called: row.called || '',
        occurrences: Number(row.occurrences) || 0,
        duration: Number(row.duration) || 0,
        firstSeen: Number(row.firstSeen) || 0,
        lastSeen: Number(row.lastSeen) || 0,
      }))
      .sort((a, b) => b.lastSeen - a.lastSeen);

    const totalCount = normalizedRows.length;
    const data = normalizedRows.slice(offset, offset + limit);

    const summary = {
      total: totalCount,
      pageCount: data.length,
      uniqueGateways: totalCount,
      totalDuration: normalizedRows.reduce((sum, r) => sum + (Number(r.duration) || 0), 0),
      totalOccurrences: normalizedRows.reduce((sum, r) => sum + (Number(r.occurrences) || 0), 0),
    };

    res.json({
      success: true,
      data,
      summary,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all CDRs
router.get('/', async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(5000, Number(req.query.limit) || 1000));
    const page = Math.max(1, Number(req.query.page) || 1);
    const offset = (page - 1) * limit;

    const cdrs = await CDR.findAll({
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });
    res.json(cdrs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upload multiple CDRs (Bulk create)
router.post('/bulk', async (req, res) => {
  try {
    console.log('Received bulk CDR upload request');
    console.log('Number of records:', req.body.length);
    console.log('First record sample:', req.body[0]);
    
    const cdrs = await CDR.bulkCreate(req.body, {
      validate: true,
      ignoreDuplicates: true
    });
    
    console.log(`Successfully created ${cdrs.length} CDRs`);

    await createNotification({
      title: 'CDR file processed',
      message: `${cdrs.length} CDR records were uploaded successfully.`,
      type: 'success',
      category: 'cdr',
      metadata: { count: cdrs.length },
    });

    res.status(201).json({ 
      message: `${cdrs.length} CDRs uploaded successfully`,
      count: cdrs.length 
    });
  } catch (err) {
    console.error('Error creating CDRs:', err.message);
    console.error('Error details:', err);
    res.status(400).json({ error: err.message });
  }
});

// Create single CDR
router.post('/', async (req, res) => {
  try {
    const cdr = await CDR.create(req.body);

    await createNotification({
      title: 'CDR created',
      message: `CDR ${cdr.id} was created.`,
      type: 'info',
      category: 'cdr',
      metadata: { cdrId: cdr.id },
    });

    res.status(201).json(cdr);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update CDR
router.put('/:id', async (req, res) => {
  try {
    const cdr = await CDR.findByPk(req.params.id);
    if (!cdr) {
      return res.status(404).json({ error: 'CDR not found' });
    }
    await cdr.update(req.body);
    res.json(cdr);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete CDR
router.delete('/:id', async (req, res) => {
  try {
    const cdr = await CDR.findByPk(req.params.id);
    if (!cdr) {
      return res.status(404).json({ error: 'CDR not found' });
    }
    await cdr.destroy();
    res.json({ message: 'CDR deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
