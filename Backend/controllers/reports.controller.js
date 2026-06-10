const { Op, fn, col } = require('sequelize');
const sequelize = require('../models/db');
const CDR = require('../models/CDR');
const Account = require('../models/Account');
const User = require('../models/User');
const CountryCode = require('../models/CountryCode');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const PaymentAllocation = require('../models/PaymentAllocation');
const VendorInvoice = require('../models/Vendorinvoice');
const H = require('../utils/reportHelper');
const { getCountryFromNumber } = H;
const { secondsToMMSS } = require('../utils/timeUtils');
const ExcelJS = require('exceljs');
const { Parser } = require('json2csv');
const EmailService = require('../services/EmailService');

/* ===================== COUNTRY CODE CACHE ===================== */
let countryCodesCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 1000 * 60 * 60;

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
      } catch (_error) {}
    }
    return [...new Set(trimmed.split(',').map((v) => v.trim()).filter(Boolean))];
  }
  if (value == null) return [];
  const single = String(value).trim();
  return single ? [single] : [];
};

const getCountryCodes = async () => {
  if (!countryCodesCache || Date.now() - cacheTimestamp > CACHE_DURATION) {
    countryCodesCache = await CountryCode.findAll({ raw: true });
    cacheTimestamp = Date.now();
    console.log('Country codes cache refreshed');
  }
  return countryCodesCache;
};

/* ===================== HELPER: FORMAT TIME ===================== */
const formatTime = (date, hour, minute = 0, isEnd = false) => {
  if (!date) return null;
  const parsedHour = Number(hour);
  const parsedMinute = Number(minute);
  const safeHour = Number.isFinite(parsedHour) ? parsedHour : 0;
  const safeMinute = Number.isFinite(parsedMinute) ? parsedMinute : 0;
  const numericDate = Number(date);

  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [year, month, day] = date.split('-').map((v) => Number(v));
    return Date.UTC(year, month - 1, day, safeHour, safeMinute, isEnd ? 59 : 0, isEnd ? 999 : 0);
  }

  let d;
  if (!isNaN(numericDate) && numericDate > 0) {
    d = new Date(numericDate);
  } else {
    d = new Date(date);
  }
  if (isNaN(d.getTime())) return null;

  if (isEnd) {
    d.setUTCHours(safeHour, safeMinute, 59, 999);
  } else {
    d.setUTCHours(safeHour, safeMinute, 0, 0);
  }
  return d.getTime();
};

/* ===================== HELPER: BUILD ACCOUNT CONDITIONS ===================== */
const buildAccountConditions = (account, vendorReport) => {
  const or = [];

  const authType = vendorReport
    ? account.vendorauthenticationType || account.customerauthenticationType
    : account.customerauthenticationType;
  const authValue = vendorReport
    ? account.vendorauthenticationValue || account.customerauthenticationValue
    : account.customerauthenticationValue;
  const authValues = normalizeAuthValues(authValue);

  if (authType === 'ip' && authValues.length > 0) {
    authValues.forEach((value) => {
      if (vendorReport) {
        or.push({ calleeip: value });
      } else {
        or.push({ callerip: value });
      }
    });
  }

  if (authType === 'custom' && authValues.length > 0) {
    authValues.forEach((value) => {
      const v = `${value}`;
      if (vendorReport) {
        or.push({ agentaccount: { [Op.like]: v } });
        or.push({ agentname: { [Op.like]: v } });
      } else {
        or.push({ customeraccount: { [Op.like]: v } });
        or.push({ customername: { [Op.like]: v } });
      }
    });
  }

  if (or.length === 0 && authType !== 'ip' && authType !== 'custom') {
    if (vendorReport) {
      const vCode = account.vendorCode || account.gatewayId;
      if (vCode) or.push({ agentaccount: vCode });
    } else {
      const cCode = account.customerCode || account.gatewayId;
      if (cCode) or.push({ customeraccount: cCode });
    }
  }

  return or;
};

/* ===================== HELPER: GET UNMATCHED CDRS ===================== */
const getUnmatchedCDRs = async (startTs, endTs, vendorReport) => {
  try {
    const accounts = await Account.findAll({
      where: { active: true },
      attributes: [
        'customerCode', 'vendorCode', 'gatewayId',
        'customerauthenticationType', 'customerauthenticationValue',
        'vendorauthenticationType', 'vendorauthenticationValue',
        'accountRole',
      ],
      raw: true,
    });

    const exclusionConditions = [];

    accounts.forEach((account) => {
      const shouldCheck = vendorReport
        ? ['vendor', 'both'].includes(account.accountRole)
        : ['customer', 'both'].includes(account.accountRole);
      if (!shouldCheck) return;

      const authType = vendorReport
        ? account.vendorauthenticationType || account.customerauthenticationType
        : account.customerauthenticationType;
      const authValue = vendorReport
        ? account.vendorauthenticationValue || account.customerauthenticationValue
        : account.customerauthenticationValue;
      const authValues = normalizeAuthValues(authValue);

      if (authType === 'ip' && authValues.length > 0) {
        authValues.forEach((value) => {
          exclusionConditions.push(vendorReport ? { calleeip: value } : { callerip: value });
        });
      } else if (authType === 'custom' && authValues.length > 0) {
        const field = vendorReport ? 'agentaccount' : 'customeraccount';
        authValues.forEach((value) => {
          exclusionConditions.push({ [field]: { [Op.like]: `%${value}%` } });
        });
      }

      const code = vendorReport ? account.vendorCode : account.customerCode;
      const codeField = vendorReport ? 'agentaccount' : 'customeraccount';
      if (code) exclusionConditions.push({ [codeField]: code });
    });

    const where = {
      [Op.and]: [
        sequelize.literal(
          `CASE WHEN "CDR"."starttime"::text ~ '^[0-9]+$' THEN "CDR"."starttime"::bigint ELSE NULL END BETWEEN ${startTs} AND ${endTs}`
        ),
      ],
    };

    if (exclusionConditions.length > 0) {
      where[Op.and].push({ [Op.not]: { [Op.or]: exclusionConditions } });
    }

    const unmatched = await CDR.findAll({
      attributes: [
        vendorReport ? 'agentaccount' : 'customeraccount',
        vendorReport ? 'agentname' : 'customername',
        vendorReport ? 'calleeip' : 'callerip',
        [fn('COUNT', col('*')), 'count'],
        [fn('SUM', H.durationSec), 'duration'],
        [fn('SUM', H.revenue), 'revenue'],
        [fn('SUM', H.cost), 'cost'],
      ],
      where,
      group: [
        vendorReport ? 'agentaccount' : 'customeraccount',
        vendorReport ? 'agentname' : 'customername',
        vendorReport ? 'calleeip' : 'callerip',
      ],
      limit: 100,
      raw: true,
    });

    console.log(` Found ${unmatched.length} unmatched CDR groups (missing gate)`);
    return unmatched;
  } catch (error) {
    console.error('!! Error fetching unmatched CDRs:', error);
    return [];
  }
};

/* ===================== HELPER: TRUNK FILTERS ===================== */
const normalizeTrunkFilter = (trunk) => {
  const raw = String(trunk || '').trim().toUpperCase();
  if (!raw || raw === 'ALL') return '';
  if (raw === 'NCLI') return 'NCLI';
  if (raw === 'CLI') return 'CLI';
  if (raw === 'CC') return 'CC';
  if (raw === 'ORTP/TDM' || raw === 'ORTP_TDM' || raw === 'ORTP-TDM' || raw === 'ORTPTDM') return 'ORTP/TDM';
  return '';
};

const normalizeCountrySelection = (country) => String(country || '').trim().toLowerCase();

const matchesSelectedCountry = (number, countryCodes, selectedCountry, skipPrefix = true) => {
  const normalizedSelectedCountry = normalizeCountrySelection(selectedCountry);
  if (!normalizedSelectedCountry || normalizedSelectedCountry === 'all') return true;
  const resolvedCountry = getCountryFromNumber(number, countryCodes, skipPrefix);
  return String(resolvedCountry || '').trim().toLowerCase() === normalizedSelectedCountry;
};

const filterRowsByCountry = (rows, countryCodes, selectedCountry, skipPrefix = true) => {
  if (!selectedCountry || normalizeCountrySelection(selectedCountry) === 'all') return rows;
  return (rows || []).filter((row) =>
    matchesSelectedCountry(row.calleee164, countryCodes, selectedCountry, skipPrefix)
  );
};

const getTrunkWhereCondition = (trunk) => {
  const normalized = normalizeTrunkFilter(trunk);
  if (!normalized) return null;
  const prefixByTrunk = { NCLI: '10', CLI: '20', 'ORTP/TDM': '30', CC: '40' };
  const prefix = prefixByTrunk[normalized];
  if (!prefix) return null;
  return { calleee164: { [Op.like]: `${prefix}%` } };
};

/* ===================== CORE: FETCH CDRs PER ACCOUNT ===================== */
/**
 * Fetches CDRs grouped by account. For a single accountId, queries that account only.
 * For 'all', fetches all active accounts matching the report type and queries each one.
 * Every returned row is tagged with _account: { id, accountId, accountName, accountRole, ownerName }.
 *
 * FIX: replaced allRows.push(...rows) with a for-loop concat to avoid
 * "Maximum call stack size exceeded" when rows arrays are very large.
 */
const fetchCDRsForAccounts = async ({
  startDate, endDate,
  startHour = 0, endHour = 23,
  startMinute = 0, endMinute = 59,
  accountId = 'all',
  vendorReport = false,
  trunk = 'all',
  attributes,
  group,
}) => {
  const startTs = Number(formatTime(startDate, startHour, startMinute));
  const endTs   = Number(formatTime(endDate, endHour, endMinute, true));

  const timerangeLiteral = sequelize.literal(
    `CASE WHEN "CDR"."starttime"::text ~ '^[0-9]+$' THEN "CDR"."starttime"::bigint ELSE NULL END BETWEEN ${startTs} AND ${endTs}`
  );

  const trunkCondition = getTrunkWhereCondition(trunk);

  // --- Resolve account list ---
  let accounts = [];

  if (!accountId || accountId === 'all') {
    const roleFilter = vendorReport
      ? { accountRole: { [Op.in]: ['vendor', 'both'] } }
      : { accountRole: { [Op.in]: ['customer', 'both'] } };

    accounts = await Account.findAll({
      where: { active: true, ...roleFilter },
      attributes: [
        'id', 'accountId', 'accountName', 'accountRole', 'accountOwner',
        'customerCode', 'vendorCode', 'gatewayId',
        'customerauthenticationType', 'customerauthenticationValue',
        'vendorauthenticationType', 'vendorauthenticationValue',
      ],
      raw: true,
    });
  } else {
    let acct = null;
    if (!isNaN(accountId) && accountId !== '') {
      acct = await Account.findByPk(parseInt(accountId), { raw: true });
    }
    if (!acct) {
      acct = await Account.findOne({
        where: {
          [Op.or]: [
            { customerCode: String(accountId) },
            { vendorCode: String(accountId) },
            { accountId: String(accountId) },
          ],
        },
        raw: true,
      });
    }
    if (acct) accounts = [acct];
  }

  if (accounts.length === 0) {
    console.warn('fetchCDRsForAccounts: no matching accounts found');
    return [];
  }

  // Pre-resolve owner names in one query
  const ownerIds = [...new Set(accounts.filter((a) => a.accountOwner).map((a) => a.accountOwner))];
  const ownerMap = {};
  if (ownerIds.length > 0) {
    const owners = await User.findAll({
      where: { id: { [Op.in]: ownerIds } },
      attributes: ['id', 'first_name', 'last_name'],
      raw: true,
    });
    owners.forEach((o) => { ownerMap[o.id] = `${o.first_name} ${o.last_name}`; });
  }

  // ── Query CDRs per account, sequential batches of 5 ──────────────────────
  // Batch size is intentionally smaller than before (5 vs 10) so that
  // Promise.all never has to hold tens of thousands of resolved rows in memory
  // simultaneously, which was the other pressure point triggering stack errors.
  const BATCH = 5;
  const allRows = [];

  for (let i = 0; i < accounts.length; i += BATCH) {
    const batch = accounts.slice(i, i + BATCH);

    const batchResults = await Promise.all(
      batch.map(async (account) => {
        const conditions = buildAccountConditions(account, vendorReport);
        if (conditions.length === 0) return [];

        const where = {
          [Op.and]: [
            timerangeLiteral,
            { [Op.or]: conditions },
            ...(trunkCondition ? [trunkCondition] : []),
          ],
        };

        try {
          const rows = await CDR.findAll({ attributes, where, group, raw: true });

          // Tag every row with its account — use a plain loop instead of .map()
          // to avoid building a second large array before we can GC the first.
          const tagged = [];
          const meta = {
            id:          account.id,
            accountId:   account.accountId,
            accountName: account.accountName,
            accountRole: account.accountRole,
            ownerName:   account.accountOwner ? ownerMap[account.accountOwner] || '' : '',
          };
          for (let j = 0; j < rows.length; j++) {
            tagged.push({ ...rows[j], _account: meta });
          }
          return tagged;
        } catch (err) {
          console.error(`CDR query failed for account ${account.accountName}:`, err.message);
          return [];
        }
      })
    );

    // ── THE KEY FIX ──────────────────────────────────────────────────────────
    // Array.prototype.push(...largeArray) passes every element as a separate
    // argument, which blows the call stack when largeArray has tens of thousands
    // of items.  Use a for-loop to append each batch result instead.
    for (let b = 0; b < batchResults.length; b++) {
      const rows = batchResults[b];
      for (let r = 0; r < rows.length; r++) {
        allRows.push(rows[r]);
      }
    }
  }

  console.log(`fetchCDRsForAccounts: ${accounts.length} accounts → ${allRows.length} CDR rows`);
  return allRows;
};

/* ===================== HOURLY REPORT ===================== */
exports.hourlyReport = async (req, res) => {
  try {
    const {
      startDate, endDate,
      accountId = 'all',
      country = 'all',
      startHour = 0, startMinute = 0,
      endHour = 23, endMinute = 59,
      vendorReport = false,
      trunk = 'all',
    } = req.body;

    const countryCodes = await getCountryCodes();
    const selectedStartHour = Number.isInteger(Number(startHour)) ? Number(startHour) : 0;
    const selectedEndHour   = Number.isInteger(Number(endHour))   ? Number(endHour)   : 23;

    const rows = await fetchCDRsForAccounts({
      startDate, endDate,
      startHour, endHour, startMinute, endMinute,
      accountId, vendorReport, trunk,
      attributes: [
        [H.hour, 'hour'],
        'calleee164',
        [fn('COUNT', col('*')),       'attempts'],
        [fn('SUM', H.completedCall),  'completed'],
        [fn('SUM', H.failedCall),     'failed'],
        [fn('SUM', H.durationSec),    'duration'],
        [fn('SUM', H.revenue),        'revenue'],
        [fn('SUM', H.cost),           'cost'],
      ],
      group: ['hour', 'calleee164'],
    });

    const filteredRows = filterRowsByCountry(rows, countryCodes, country, true);

    const utcTodayYmd  = new Date().toISOString().slice(0, 10);
    const startDateYmd = String(startDate || '').slice(0, 10);
    const endDateYmd   = String(endDate   || '').slice(0, 10);
    const isSingleUtcToday = startDateYmd === utcTodayYmd && endDateYmd === utcTodayYmd;
    const maxHour = isSingleUtcToday
      ? Math.min(selectedEndHour, new Date().getUTCHours())
      : selectedEndHour;

    const hourlyMap = new Map();
    for (let h = selectedStartHour; h <= maxHour; h++) {
      hourlyMap.set(h, { hour: h, attempts: 0, completed: 0, failed: 0, duration: 0, revenue: 0, cost: 0 });
    }

    for (let i = 0; i < filteredRows.length; i++) {
      const r = filteredRows[i];
      const h = Number.parseInt(String(r.hour ?? '').trim(), 10);
      if (Number.isNaN(h) || !hourlyMap.has(h)) continue;
      const agg = hourlyMap.get(h);
      agg.attempts  += Number(r.attempts  || 0);
      agg.completed += Number(r.completed || 0);
      agg.failed    += Number(r.failed    || 0);
      agg.duration  += Number(r.duration  || 0);
      agg.revenue   += Number(r.revenue   || 0);
      agg.cost      += Number(r.cost      || 0);
    }

    const resolvedOwnerName = accountId !== 'all' && rows.length > 0
      ? rows[0]._account?.ownerName || ''
      : '';

    const data = [];
    const hourKeys = Array.from(hourlyMap.keys()).sort((a, b) => a - b);
    for (let i = 0; i < hourKeys.length; i++) {
      const r = hourlyMap.get(hourKeys[i]);
      data.push({
        hour:         r.hour,
        accountOwner: resolvedOwnerName,
        attempts:     r.attempts,
        completed:    r.completed,
        asr:          r.attempts  > 0 ? parseFloat(((r.completed / r.attempts) * 100).toFixed(4)) : 0,
        acd:          r.completed > 0 ? parseFloat((r.duration / r.completed).toFixed(4)) : 0,
        duration:     r.duration,
        revenue:      parseFloat(r.revenue.toFixed(4)),
        cost:         parseFloat(r.cost.toFixed(4)),
        margin:       parseFloat((r.revenue - r.cost).toFixed(4)),
      });
    }

    let totalAttempts = 0, totalCompleted = 0, totalRevenue = 0;
    for (let i = 0; i < data.length; i++) {
      totalAttempts  += data[i].attempts;
      totalCompleted += data[i].completed;
      totalRevenue   += data[i].revenue;
    }

    res.json({
      success: true,
      data,
      summary: {
        totalAttempts,
        totalCompleted,
        totalRevenue,
        avgASR: totalAttempts > 0
          ? parseFloat(((totalCompleted / totalAttempts) * 100).toFixed(4))
          : 0,
      },
    });
  } catch (e) {
    console.error('Hourly Report Error:', e);
    res.status(500).json({ error: e.message });
  }
};

/* ===================== MARGIN REPORT ===================== */
exports.marginReport = async (req, res) => {
  try {
    const {
      startDate, endDate, accountId = 'all', country = 'all',
      startHour = 0, startMinute = 0, endHour = 23, endMinute = 59,
      vendorReport = false, trunk = 'all',
    } = req.body;

    const countryCodes = await getCountryCodes();

    const cdrs = await fetchCDRsForAccounts({
      startDate, endDate, startHour, endHour, startMinute, endMinute,
      accountId, vendorReport, trunk,
      attributes: [
        vendorReport ? 'agentaccount' : 'customeraccount',
        vendorReport ? 'agentname'    : 'customername',
        'calleee164',
        [fn('COUNT', col('*')),       'attempts'],
        [fn('SUM', H.completedCall),  'completed'],
        [fn('SUM', H.durationSec),    'duration'],
        [fn('SUM', H.revenue),        'revenue'],
        [fn('SUM', H.cost),           'cost'],
      ],
      group: [
        vendorReport ? 'agentaccount' : 'customeraccount',
        vendorReport ? 'agentname'    : 'customername',
        'calleee164',
      ],
    });

    const filteredCdrs = filterRowsByCountry(cdrs, countryCodes, country, true);

    if (filteredCdrs.length === 0) {
      return res.json({
        success: true, data: [],
        summary: { totalRevenue: 0, totalCost: 0, totalMargin: 0, avgMarginPercent: 0 },
        message: 'No CDR records found for the selected criteria',
      });
    }

    const groupedData = {};
    for (let i = 0; i < filteredCdrs.length; i++) {
      const r = filteredCdrs[i];
      const destination = getCountryFromNumber(r.calleee164, countryCodes, true);
      const key = `${r._account.accountId}|${destination}`;

      if (!groupedData[key]) {
        groupedData[key] = {
          accountCode: r._account.accountId,
          accountName: r._account.accountName,
          ownerName:   r._account.ownerName,
          destination,
          attempts: 0, completed: 0, duration: 0, revenue: 0, cost: 0,
        };
      }
      const g = groupedData[key];
      g.attempts  += Number(r.attempts);
      g.completed += Number(r.completed);
      g.duration  += Number(r.duration);
      g.revenue   += Number(r.revenue);
      g.cost      += Number(r.cost);
    }

    const grouped = Object.values(groupedData);
    const data = [];
    for (let i = 0; i < grouped.length; i++) {
      const r = grouped[i];
      const margin = r.revenue - r.cost;
      data.push({
        accountCode:   r.accountCode,
        accountName:   r.accountName,
        accountOwner:  r.ownerName,
        destination:   r.destination,
        attempts:      r.attempts,
        completed:     r.completed,
        asr:           r.attempts  > 0 ? parseFloat(((r.completed / r.attempts) * 100).toFixed(4)) : 0,
        acd:           r.completed > 0 ? parseFloat((r.duration / r.completed).toFixed(4)) : 0,
        duration:      r.duration,
        revenue:       parseFloat(r.revenue.toFixed(6)),
        cost:          parseFloat(r.cost.toFixed(6)),
        margin:        parseFloat(margin.toFixed(6)),
        marginPercent: r.revenue > 0 ? parseFloat(((margin / r.revenue) * 100).toFixed(4)) : 0,
      });
    }

    let totalRevenue = 0, totalCost = 0, totalMargin = 0, sumMarginPercent = 0;
    for (let i = 0; i < data.length; i++) {
      totalRevenue     += data[i].revenue;
      totalCost        += data[i].cost;
      totalMargin      += data[i].margin;
      sumMarginPercent += data[i].marginPercent;
    }

    res.json({
      success: true,
      data,
      summary: {
        totalRevenue,
        totalCost,
        totalMargin,
        avgMarginPercent: data.length > 0
          ? parseFloat((sumMarginPercent / data.length).toFixed(4))
          : 0,
      },
    });
  } catch (e) {
    console.error('Margin Report Error:', e);
    res.status(500).json({ error: e.message });
  }
};

/* ===================== CUSTOMER TRAFFIC REPORT ===================== */
exports.customerTrafficReport = async (req, res) => {
  try {
    const {
      startDate, endDate, accountId = 'all', country = 'all',
      startHour = 0, startMinute = 0, endHour = 23, endMinute = 59,
      vendorReport = false, trunk = 'all',
    } = req.body;

    const countryCodes = await getCountryCodes();

    const cdrs = await fetchCDRsForAccounts({
      startDate, endDate, startHour, endHour, startMinute, endMinute,
      accountId, vendorReport, trunk,
      attributes: [
        'customeraccount', 'customername',
        'agentaccount', 'agentname', 'calleee164',
        [fn('COUNT', col('*')),       'attempts'],
        [fn('SUM', H.completedCall),  'completed'],
        [fn('SUM', H.durationSec),    'duration'],
        [fn('SUM', H.revenue),        'revenue'],
        [fn('SUM', H.cost),           'cost'],
      ],
      group: ['customeraccount', 'customername', 'agentaccount', 'agentname', 'calleee164'],
    });

    const filteredCdrs = filterRowsByCountry(cdrs, countryCodes, country, true);

    if (filteredCdrs.length === 0) {
      return res.json({
        success: true, data: [],
        summary: { totalCustomers: 0, totalAttempts: 0, totalRevenue: 0, avgASR: 0 },
        message: 'No CDR records found for the selected criteria',
      });
    }

    const groupedData = {};
    for (let i = 0; i < filteredCdrs.length; i++) {
      const r = filteredCdrs[i];
      const destination = getCountryFromNumber(r.calleee164, countryCodes, true);
      const key = `${r.customeraccount}|${r.agentaccount}|${destination}`;

      if (!groupedData[key]) {
        groupedData[key] = {
          customeraccount: r.customeraccount,
          customername:    vendorReport ? r.customername : r._account.accountName,
          agentaccount:    r.agentaccount,
          agentname:       vendorReport ? r._account.accountName : r.agentname,
          ownerName:       r._account.ownerName,
          destination,
          attempts: 0, completed: 0, duration: 0, revenue: 0, cost: 0,
        };
      }
      const g = groupedData[key];
      g.attempts  += Number(r.attempts);
      g.completed += Number(r.completed);
      g.duration  += Number(r.duration);
      g.revenue   += Number(r.revenue);
      g.cost      += Number(r.cost);
    }

    const grouped = Object.values(groupedData);
    const data = [];
    for (let i = 0; i < grouped.length; i++) {
      const r    = grouped[i];
      const rev  = r.revenue;
      const cst  = r.cost;
      const margin = rev - cst;
      const dur  = r.duration;
      const comp = r.completed;
      data.push({
        custAccountCode:     r.customeraccount,
        vendAccountCode:     r.agentaccount,
        accountOwner:        r.ownerName,
        customer:            r.customername,
        custDestination:     r.destination,
        vendor:              r.agentname,
        vendDestination:     r.destination,
        attempts:            r.attempts,
        completed:           comp,
        asr:                 r.attempts > 0 ? parseFloat(((comp / r.attempts) * 100).toFixed(4)) : 0,
        acd:                 comp > 0 ? parseFloat((dur / comp).toFixed(4)) : 0,
        rawDuration:         dur,
        custRoundedDuration: comp > 0 ? parseFloat((dur / comp).toFixed(4)) : 0,
        vendRoundedDuration: comp > 0 ? parseFloat((dur / comp).toFixed(4)) : 0,
        revenue:             parseFloat(rev.toFixed(6)),
        revenuePerMin:       dur > 0 ? parseFloat((rev / (dur / 60)).toFixed(4)) : 0,
        cost:                parseFloat(cst.toFixed(6)),
        costPerMin:          dur > 0 ? parseFloat((cst / (dur / 60)).toFixed(4)) : 0,
        margin:              parseFloat(margin.toFixed(6)),
        marginPerMin:        dur > 0 ? parseFloat((margin / (dur / 60)).toFixed(4)) : 0,
        marginPercent:       rev > 0 ? parseFloat(((margin / rev) * 100).toFixed(4)) : 0,
        failedCalls:         r.attempts - comp,
      });
    }

    const customerSet = new Set();
    let totalAttempts = 0, totalRevenue = 0, totalCost = 0, sumASR = 0;
    for (let i = 0; i < data.length; i++) {
      customerSet.add(data[i].customer);
      totalAttempts += data[i].attempts;
      totalRevenue  += data[i].revenue;
      totalCost     += data[i].cost;
      sumASR        += data[i].asr;
    }

    res.json({
      success: true,
      data,
      summary: {
        totalCustomers: customerSet.size,
        totalAttempts,
        totalRevenue,
        totalCost,
        avgASR: data.length > 0 ? parseFloat((sumASR / data.length).toFixed(6)) : 0,
      },
    });
  } catch (e) {
    console.error('Customer Traffic Report Error:', e);
    res.status(500).json({ error: e.message });
  }
};

/* ===================== CUSTOMER-ONLY TRAFFIC REPORT ===================== */
exports.customerOnlyTrafficReport = async (req, res) => {
  try {
    const {
      startDate, endDate, accountId = 'all', country = 'all',
      startHour = 0, startMinute = 0, endHour = 23, endMinute = 59,
      trunk = 'all',
    } = req.body;

    const countryCodes = await getCountryCodes();

    const cdrs = await fetchCDRsForAccounts({
      startDate, endDate, startHour, endHour, startMinute, endMinute,
      accountId, vendorReport: false, trunk,
      attributes: [
        'customeraccount', 'customername', 'calleee164',
        [fn('COUNT', col('*')),       'attempts'],
        [fn('SUM', H.completedCall),  'completed'],
        [fn('SUM', H.durationSec),    'duration'],
        [fn('SUM', H.revenue),        'revenue'],
        [fn('SUM', H.cost),           'cost'],
      ],
      group: ['customeraccount', 'customername', 'calleee164'],
    });

    const filteredCdrs = filterRowsByCountry(cdrs, countryCodes, country, true);

    if (filteredCdrs.length === 0) {
      return res.json({
        success: true, data: [],
        summary: { totalCustomers: 0, totalAttempts: 0, totalRevenue: 0, avgASR: 0 },
        message: 'No CDR records found for the selected criteria',
      });
    }

    const groupedData = {};
    for (let i = 0; i < filteredCdrs.length; i++) {
      const r = filteredCdrs[i];
      const vendDestination = getCountryFromNumber(r.calleee164, countryCodes, true);
      const key = `${r._account.accountId}|${vendDestination}`;

      if (!groupedData[key]) {
        groupedData[key] = {
          customeraccount: r.customeraccount,
          customername:    r._account.accountName,
          ownerName:       r._account.ownerName,
          vendDestination,
          attempts: 0, completed: 0, duration: 0, revenue: 0, cost: 0,
        };
      }
      const g = groupedData[key];
      g.attempts  += Number(r.attempts);
      g.completed += Number(r.completed);
      g.duration  += Number(r.duration);
      g.revenue   += Number(r.revenue);
      g.cost      += Number(r.cost);
    }

    const grouped = Object.values(groupedData);
    const data = [];
    for (let i = 0; i < grouped.length; i++) {
      const r    = grouped[i];
      const rev  = r.revenue;
      const cst  = r.cost;
      const margin = rev - cst;
      const dur  = r.duration;
      const comp = r.completed;
      data.push({
        custAccountCode: r.customeraccount,
        accountOwner:    r.ownerName,
        customer:        r.customername,
        vendDestination: r.vendDestination,
        attempts:        r.attempts,
        completed:       comp,
        asr:             r.attempts > 0 ? parseFloat(((comp / r.attempts) * 100).toFixed(4)) : 0,
        acd:             comp > 0 ? parseFloat((dur / comp).toFixed(4)) : 0,
        revenue:         parseFloat(rev.toFixed(6)),
        cost:            parseFloat(cst.toFixed(6)),
        margin:          parseFloat(margin.toFixed(6)),
        marginPercent:   rev > 0 ? parseFloat(((margin / rev) * 100).toFixed(4)) : 0,
      });
    }

    const customerSet = new Set();
    let totalAttempts = 0, totalRevenue = 0, sumASR = 0;
    for (let i = 0; i < data.length; i++) {
      customerSet.add(data[i].customer);
      totalAttempts += data[i].attempts;
      totalRevenue  += data[i].revenue;
      sumASR        += data[i].asr;
    }

    res.json({
      success: true,
      data,
      summary: {
        totalCustomers: customerSet.size,
        totalAttempts,
        totalRevenue,
        avgASR: data.length > 0 ? parseFloat((sumASR / data.length).toFixed(6)) : 0,
      },
    });
  } catch (e) {
    console.error('Customer-only Traffic Error:', e);
    res.status(500).json({ error: e.message });
  }
};

/* ===================== VENDOR-ONLY TRAFFIC REPORT ===================== */
exports.vendorTrafficReport = async (req, res) => {
  try {
    const {
      startDate, endDate, accountId = 'all', country = 'all',
      startHour = 0, startMinute = 0, endHour = 23, endMinute = 59,
      trunk = 'all',
    } = req.body;

    const countryCodes = await getCountryCodes();

    const cdrs = await fetchCDRsForAccounts({
      startDate, endDate, startHour, endHour, startMinute, endMinute,
      accountId, vendorReport: true, trunk,
      attributes: [
        'agentaccount', 'agentname', 'calleee164',
        [fn('COUNT', col('*')),       'attempts'],
        [fn('SUM', H.completedCall),  'completed'],
        [fn('SUM', H.durationSec),    'duration'],
        [fn('SUM', H.revenue),        'revenue'],
        [fn('SUM', H.cost),           'cost'],
      ],
      group: ['agentaccount', 'agentname', 'calleee164'],
    });

    const filteredCdrs = filterRowsByCountry(cdrs, countryCodes, country, true);

    if (filteredCdrs.length === 0) {
      return res.json({
        success: true, data: [],
        summary: { totalVendors: 0, totalAttempts: 0, totalRevenue: 0, avgASR: 0 },
        message: 'No CDR records found for the selected criteria',
      });
    }

    const groupedData = {};
    for (let i = 0; i < filteredCdrs.length; i++) {
      const r = filteredCdrs[i];
      const vendCountry = getCountryFromNumber(r.calleee164, countryCodes, true);
      const key = `${r._account.accountId}|${vendCountry}`;

      if (!groupedData[key]) {
        groupedData[key] = {
          agentaccount:    r.agentaccount,
          agentname:       r._account.accountName,
          ownerName:       r._account.ownerName,
          vendDestination: vendCountry,
          attempts: 0, completed: 0, duration: 0, revenue: 0, cost: 0,
        };
      }
      const g = groupedData[key];
      g.attempts  += Number(r.attempts);
      g.completed += Number(r.completed);
      g.duration  += Number(r.duration);
      g.revenue   += Number(r.revenue);
      g.cost      += Number(r.cost);
    }

    const grouped = Object.values(groupedData);
    const data = [];
    for (let i = 0; i < grouped.length; i++) {
      const r    = grouped[i];
      const rev  = r.revenue;
      const cst  = r.cost;
      const margin = rev - cst;
      const dur  = r.duration;
      const comp = r.completed;
      data.push({
        vendAccountCode: r.agentaccount,
        accountOwner:    r.ownerName,
        vendor:          r.agentname,
        vendDestination: r.vendDestination,
        attempts:        r.attempts,
        completed:       comp,
        asr:             r.attempts > 0 ? parseFloat(((comp / r.attempts) * 100).toFixed(4)) : 0,
        acd:             comp > 0 ? parseFloat((dur / comp).toFixed(4)) : 0,
        revenue:         parseFloat(rev.toFixed(6)),
        cost:            parseFloat(cst.toFixed(6)),
        costPerMin:      dur > 0 ? parseFloat((cst / (dur / 60)).toFixed(6)) : 0,
        margin:          parseFloat(margin.toFixed(6)),
        marginPercent:   rev > 0 ? parseFloat(((margin / rev) * 100).toFixed(4)) : 0,
      });
    }

    const vendorSet = new Set();
    let totalAttempts = 0, totalRevenue = 0, totalCost = 0, sumASR = 0;
    for (let i = 0; i < data.length; i++) {
      vendorSet.add(data[i].vendor);
      totalAttempts += data[i].attempts;
      totalRevenue  += data[i].revenue;
      totalCost     += data[i].cost;
      sumASR        += data[i].asr;
    }

    res.json({
      success: true,
      data,
      summary: {
        totalVendors:   vendorSet.size,
        totalAttempts,
        totalRevenue,
        totalCost,
        avgASR: data.length > 0 ? parseFloat((sumASR / data.length).toFixed(6)) : 0,
      },
    });
  } catch (e) {
    console.error('Vendor-only Traffic Error:', e);
    res.status(500).json({ error: e.message });
  }
};

/* ===================== NEGATIVE MARGIN REPORT ===================== */
exports.negativeMarginReport = async (req, res) => {
  try {
    const {
      startDate, endDate, accountId = 'all', country = 'all',
      startHour = 0, startMinute = 0, endHour = 23, endMinute = 59,
      vendorReport = false, trunk = 'all',
    } = req.body;

    const countryCodes = await getCountryCodes();

    const cdrs = await fetchCDRsForAccounts({
      startDate, endDate, startHour, endHour, startMinute, endMinute,
      accountId, vendorReport, trunk,
      attributes: [
        vendorReport ? 'agentaccount' : 'customeraccount',
        vendorReport ? 'agentname'    : 'customername',
        'calleee164',
        [fn('COUNT', col('*')),       'attempts'],
        [fn('SUM', H.completedCall),  'completed'],
        [fn('SUM', H.durationSec),    'duration'],
        [fn('SUM', H.revenue),        'revenue'],
        [fn('SUM', H.cost),           'cost'],
      ],
      group: [
        vendorReport ? 'agentaccount' : 'customeraccount',
        vendorReport ? 'agentname'    : 'customername',
        'calleee164',
      ],
    });

    const filteredCdrs = filterRowsByCountry(cdrs, countryCodes, country, true);

    if (filteredCdrs.length === 0) {
      return res.json({
        success: true, data: [],
        summary: { totalLoss: 0, negativeMarginCalls: 0, affectedCustomers: 0, affectedDestinations: 0 },
        message: 'No CDR records found for the selected criteria',
      });
    }

    const groupedData = {};
    for (let i = 0; i < filteredCdrs.length; i++) {
      const r = filteredCdrs[i];
      const destination = getCountryFromNumber(r.calleee164, countryCodes, true);
      const key = `${r._account.accountId}|${destination}`;

      if (!groupedData[key]) {
        groupedData[key] = {
          accountCode: r._account.accountId,
          accountName: r._account.accountName,
          ownerName:   r._account.ownerName,
          destination,
          attempts: 0, completed: 0, duration: 0, revenue: 0, cost: 0,
        };
      }
      const g = groupedData[key];
      g.attempts  += Number(r.attempts);
      g.completed += Number(r.completed);
      g.duration  += Number(r.duration);
      g.revenue   += Number(r.revenue);
      g.cost      += Number(r.cost);
    }

    const grouped = Object.values(groupedData);
    const data = [];
    for (let i = 0; i < grouped.length; i++) {
      const r = grouped[i];
      const margin = r.revenue - r.cost;
      if (margin >= 0) continue; // filter negative margin only
      data.push({
        accountCode:   r.accountCode,
        accountName:   r.accountName,
        accountOwner:  r.ownerName,
        destination:   r.destination,
        attempts:      r.attempts,
        completed:     r.completed,
        asr:           r.attempts  > 0 ? parseFloat(((r.completed / r.attempts) * 100).toFixed(2)) : 0,
        acd:           r.completed > 0 ? parseFloat((r.duration / r.completed).toFixed(4)) : 0,
        duration:      r.duration,
        revenue:       parseFloat(r.revenue.toFixed(6)),
        cost:          parseFloat(r.cost.toFixed(6)),
        margin:        parseFloat(margin.toFixed(6)),
        marginPercent: r.revenue > 0 ? parseFloat(((margin / r.revenue) * 100).toFixed(4)) : 0,
      });
    }

    const accountSet     = new Set();
    const destinationSet = new Set();
    let totalLoss = 0, negativeMarginCalls = 0;
    for (let i = 0; i < data.length; i++) {
      totalLoss           += data[i].margin;
      negativeMarginCalls += data[i].attempts;
      accountSet.add(data[i].accountCode);
      destinationSet.add(data[i].destination);
    }

    res.json({
      success: true,
      data,
      summary: {
        totalLoss,
        negativeMarginCalls,
        affectedCustomers:    accountSet.size,
        affectedDestinations: destinationSet.size,
      },
    });
  } catch (e) {
    console.error('Negative Margin Report Error:', e);
    res.status(500).json({ error: e.message });
  }
};

/* ===================== DEBUG ENDPOINT ===================== */
exports.debugMapping = async (req, res) => {
  try {
    const { accountId, vendorReport = false } = req.body;

    if (!accountId || accountId === 'all') {
      return res.json({
        success: true,
        message: 'No specific account selected',
        sampleCdrs: await CDR.findAll({
          limit: 5,
          attributes: ['customeraccount', 'agentaccount', 'customername', 'agentname', 'starttime'],
          raw: true,
        }),
      });
    }

    let account = null;
    if (!isNaN(accountId) && accountId !== '') {
      account = await Account.findByPk(parseInt(accountId));
    }
    if (!account) {
      account = await Account.findOne({
        where: {
          [Op.or]: [
            { [vendorReport ? 'vendorCode' : 'customerCode']: String(accountId) },
            { accountId: String(accountId) },
          ],
        },
      });
    }

    if (!account) {
      return res.json({ success: false, message: `Account not found for ID: ${accountId}` });
    }

    const conditions = buildAccountConditions(account, vendorReport);
    let cdrs = [];
    if (conditions.length > 0) {
      cdrs = await CDR.findAll({
        where: { [Op.or]: conditions },
        limit: 5,
        attributes: ['customeraccount', 'agentaccount', 'customername', 'agentname', 'callerip', 'agentip', 'starttime'],
        raw: true,
      });
    }

    res.json({
      success: true,
      account: {
        id:                          account.id,
        accountId:                   account.accountId,
        accountName:                 account.accountName,
        customerCode:                account.customerCode,
        vendorCode:                  account.vendorCode,
        gatewayId:                   account.gatewayId,
        customerauthenticationType:  account.customerauthenticationType,
        customerauthenticationValue: account.customerauthenticationValue,
        accountRole:                 account.accountRole,
        accountOwner:                account.accountOwner,
      },
      conditions,
      sampleCdrs: cdrs,
      message: conditions.length > 0
        ? `Found ${cdrs.length} sample CDRs using ${account.customerauthenticationType} authentication`
        : 'No valid authentication conditions found',
    });
  } catch (e) {
    console.error('Debug Mapping Error:', e);
    res.status(500).json({ error: e.message });
  }
};

/* ===================== REPORT ACCOUNTS ===================== */
exports.getReportAccounts = async (req, res) => {
  try {
    const accounts = await Account.findAll({
      attributes: [
        'id', 'accountId', 'accountName', 'accountRole', 'gatewayId',
        'customerCode', 'vendorCode', 'billingCycle', 'billingStartDate',
        'customerLastBillingDate', 'customerNextBillingDate',
        'vendorLastBillingDate', 'vendorNextBillingDate',
        'accountOwner', 'customerauthenticationType', 'customerauthenticationValue',
        'billingType', 'balance', 'originalCreditLimit', 'createdAt', 'trunks',
      ],
      where: { active: true },
      order: [['accountName', 'ASC']],
      raw: true,
    });

    const ownerIds = [...new Set(accounts.filter((a) => a.accountOwner).map((a) => a.accountOwner))];
    const owners = ownerIds.length > 0
      ? await User.findAll({
          where: { id: { [Op.in]: ownerIds } },
          attributes: ['id', 'first_name', 'last_name'],
          raw: true,
        })
      : [];

    const ownerMapByUserId = {};
    owners.forEach((o) => { ownerMapByUserId[o.id] = `${o.first_name} ${o.last_name}`; });

    const accountsWithOwners = accounts.map((a) => ({
      ...a,
      ownerName: a.accountOwner ? ownerMapByUserId[a.accountOwner] || '' : '',
    }));

    res.json({
      success: true,
      customers: accountsWithOwners.filter((a) => ['customer', 'both'].includes(a.accountRole)),
      vendors:   accountsWithOwners.filter((a) => ['vendor',   'both'].includes(a.accountRole)),
    });
  } catch (e) {
    console.error('Get Report Accounts Error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
};

/* ===================== ACCOUNT EXPOSURE (CDR BASED) ===================== */
exports.getAccountExposure = async (req, res) => {
  try {
    const { accountId, account, startDate, endDate } = req.body || {};

    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      return res.status(400).json({ success: false, error: 'Start date cannot be after end date' });
    }

    const startTs = startDate ? Number(formatTime(startDate, 0, 0)) : 0;
    const endTs   = endDate   ? Number(formatTime(endDate, 23, 59, true)) : Date.now();

    if (!Number.isFinite(startTs) || !Number.isFinite(endTs)) {
      return res.status(400).json({ success: false, error: 'Invalid date range' });
    }

    const timeRangeLiteral = sequelize.literal(
      `CASE WHEN "CDR"."starttime"::text ~ '^[0-9]+$' THEN "CDR"."starttime"::bigint ELSE NULL END BETWEEN ${startTs} AND ${endTs}`
    );

    const lookupCandidates = [
      accountId,
      account?.id,
      account?.accountId,
      account?.accountName,
      account?.customerCode,
      account?.vendorCode,
    ].filter((v) => v !== undefined && v !== null && String(v).trim() !== '');

    if (lookupCandidates.length === 0) {
      return res.status(400).json({ success: false, error: 'Account identifier is required' });
    }

    const numericId = lookupCandidates.find((v) => /^\d+$/.test(String(v)));
    let selectedAccount = null;
    if (numericId) selectedAccount = await Account.findByPk(Number(numericId));

    if (!selectedAccount) {
      selectedAccount = await Account.findOne({
        where: {
          [Op.or]: lookupCandidates.map((v) => ({
            [Op.or]: [
              { accountId:    String(v) },
              { accountName:  String(v) },
              { customerCode: String(v) },
              { vendorCode:   String(v) },
            ],
          })),
        },
      });
    }

    if (!selectedAccount) {
      return res.status(404).json({ success: false, error: 'Account not found' });
    }

    const accountJson     = selectedAccount.toJSON();
    const includeCustomer = ['customer', 'both'].includes(accountJson.accountRole);
    const includeVendor   = ['vendor',   'both'].includes(accountJson.accountRole);

    const aggregateSide = async (conditions) => {
      if (!conditions || conditions.length === 0) {
        return { attempts: 0, completed: 0, failed: 0, duration: 0, revenue: 0, cost: 0 };
      }
      const row = await CDR.findOne({
        attributes: [
          [fn('COUNT', col('*')),       'attempts'],
          [fn('SUM', H.completedCall),  'completed'],
          [fn('SUM', H.failedCall),     'failed'],
          [fn('SUM', H.durationSec),    'duration'],
          [fn('SUM', H.revenue),        'revenue'],
          [fn('SUM', H.cost),           'cost'],
        ],
        where: { [Op.and]: [timeRangeLiteral, { [Op.or]: conditions }] },
        raw: true,
      });
      return {
        attempts:  Number(row?.attempts  || 0),
        completed: Number(row?.completed || 0),
        failed:    Number(row?.failed    || 0),
        duration:  Number(row?.duration  || 0),
        revenue:   Number(row?.revenue   || 0),
        cost:      Number(row?.cost      || 0),
      };
    };

    const customerConditions = includeCustomer ? buildAccountConditions(accountJson, false) : [];
    const vendorConditions   = includeVendor   ? buildAccountConditions(accountJson, true)  : [];

    const [customerAgg, vendorAgg] = await Promise.all([
      aggregateSide(customerConditions),
      aggregateSide(vendorConditions),
    ]);

    const customerExpense = customerAgg.revenue;
    const vendorExpense   = vendorAgg.cost;
    const netAmount       = customerExpense - vendorExpense;

    res.json({
      success: true,
      account: {
        id:           accountJson.id,
        accountId:    accountJson.accountId,
        accountName:  accountJson.accountName,
        accountRole:  accountJson.accountRole,
        customerCode: accountJson.customerCode,
        vendorCode:   accountJson.vendorCode,
      },
      summary: {
        customerExpense,
        vendorExpense,
        netAmount,
        netPosition: netAmount > 0 ? 'receivable' : netAmount < 0 ? 'payable' : 'balanced',
      },
      customerMetrics: customerAgg,
      vendorMetrics:   vendorAgg,
      dateRange:   { startDate: startDate || null, endDate: endDate || null, startTs, endTs },
      generatedAt: Date.now(),
    });
  } catch (error) {
    console.error('Get Account Exposure Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/* ===================== ALL ACCOUNTS EXPOSURE (PAGINATED) ===================== */
exports.getAllAccountExposure = async (req, res) => {
  try {
    const { startDate, endDate, page = 1, limit = 10 } = req.query;

    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      return res.status(400).json({ success: false, error: 'Start date cannot be after end date' });
    }

    const startTs = startDate ? Number(formatTime(startDate, 0, 0)) : 0;
    const endTs   = endDate   ? Number(formatTime(endDate, 23, 59, true)) : Date.now();

    if (!Number.isFinite(startTs) || !Number.isFinite(endTs)) {
      return res.status(400).json({ success: false, error: 'Invalid date range' });
    }

    const timeRangeLiteral = sequelize.literal(
      `CASE WHEN "CDR"."starttime"::text ~ '^[0-9]+$' THEN "CDR"."starttime"::bigint ELSE NULL END BETWEEN ${startTs} AND ${endTs}`
    );

    const allAccounts = await Account.findAll({
      where: { active: true },
      attributes: [
        'id', 'accountId', 'accountName', 'accountRole',
        'customerCode', 'vendorCode', 'gatewayId',
        'customerauthenticationType', 'customerauthenticationValue',
        'vendorauthenticationType', 'vendorauthenticationValue',
      ],
      order: [['accountName', 'ASC']],
      raw: true,
    });

    const total       = allAccounts.length;
    const parsedPage  = Math.max(1, Number(page));
    const parsedLimit = Math.min(50, Math.max(1, Number(limit)));
    const totalPages  = Math.ceil(total / parsedLimit);
    const offset      = (parsedPage - 1) * parsedLimit;
    const slice       = allAccounts.slice(offset, offset + parsedLimit);

    const aggregateSide = async (conditions) => {
      if (!conditions || conditions.length === 0) {
        return { attempts: 0, completed: 0, failed: 0, duration: 0, revenue: 0, cost: 0 };
      }
      const row = await CDR.findOne({
        attributes: [
          [fn('COUNT', col('*')),       'attempts'],
          [fn('SUM', H.completedCall),  'completed'],
          [fn('SUM', H.failedCall),     'failed'],
          [fn('SUM', H.durationSec),    'duration'],
          [fn('SUM', H.revenue),        'revenue'],
          [fn('SUM', H.cost),           'cost'],
        ],
        where: { [Op.and]: [timeRangeLiteral, { [Op.or]: conditions }] },
        raw: true,
      });
      return {
        attempts:  Number(row?.attempts  || 0),
        completed: Number(row?.completed || 0),
        failed:    Number(row?.failed    || 0),
        duration:  Number(row?.duration  || 0),
        revenue:   Number(row?.revenue   || 0),
        cost:      Number(row?.cost      || 0),
      };
    };

    const results = await Promise.all(
      slice.map(async (account) => {
        try {
          const includeCustomer = ['customer', 'both'].includes(account.accountRole);
          const includeVendor   = ['vendor',   'both'].includes(account.accountRole);

          const customerConditions = includeCustomer ? buildAccountConditions(account, false) : [];
          const vendorConditions   = includeVendor   ? buildAccountConditions(account, true)  : [];

          const [customerAgg, vendorAgg] = await Promise.all([
            aggregateSide(customerConditions),
            aggregateSide(vendorConditions),
          ]);

          const customerExpense = customerAgg.revenue;
          const vendorExpense   = vendorAgg.cost;
          const netAmount       = customerExpense - vendorExpense;
          const diff            = Math.abs(netAmount);

          return {
            accountName:     account.accountName,
            accountRole:     account.accountRole,
            customerExpense: parseFloat(customerExpense.toFixed(4)),
            vendorExpense:   parseFloat(vendorExpense.toFixed(4)),
            totalReceivable: netAmount > 0 ? parseFloat(diff.toFixed(4)) : 0,
            totalPayable:    netAmount < 0 ? parseFloat(diff.toFixed(4)) : 0,
            netAmount:       parseFloat(diff.toFixed(4)),
            netPosition:     netAmount > 0 ? 'receivable' : netAmount < 0 ? 'payable' : 'balanced',
          };
        } catch (err) {
          console.error(`Exposure error for account ${account.accountName}:`, err.message);
          return {
            accountName: account.accountName, accountRole: account.accountRole,
            customerExpense: 0, vendorExpense: 0,
            totalReceivable: 0, totalPayable: 0, netAmount: 0,
            netPosition: 'balanced', error: true,
          };
        }
      })
    );

    return res.json({
      success: true,
      data: results,
      pagination: { total, page: parsedPage, limit: parsedLimit, totalPages },
      dateRange:   { startDate: startDate || null, endDate: endDate || null },
      generatedAt: Date.now(),
    });
  } catch (e) {
    console.error('Get All Account Exposure Error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
};

/* ===================== EXPORT REPORT ===================== */
exports.exportReport = async (req, res) => {
  try {
    const { data, format, fileName, meta = {} } = req.body;

    if (!data || !Array.isArray(data)) {
      return res.status(400).json({ error: 'Data is required and must be an array' });
    }

    const columns = data.length > 0
      ? Array.from(new Set(data.flatMap((d) => Object.keys(d))))
      : [];

    const safeMeta = {
      title:        meta.title        || 'Report',
      account:      meta.account      || '',
      accountCode:  meta.accountCode  || '',
      startDate:    meta.startDate    || '',
      endDate:      meta.endDate      || '',
      periodLabel:  meta.periodLabel  || '',
      trunk:        meta.trunk        || '',
      generatedAt:  meta.generatedAt  || Date.now(),
      summary:      meta.summary      || {},
      totalRecords: Number(meta.totalRecords || data.length || 0),
    };

    const columnToLetter = (col) => {
      let temp; let letter = '';
      while (col > 0) {
        temp = (col - 1) % 26;
        letter = String.fromCharCode(65 + temp) + letter;
        col = Math.floor((col - temp - 1) / 26);
      }
      return letter;
    };

    const normalize = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    if (format === 'excel') {
      const workbook  = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Report');
      const colCount  = Math.max(columns.length, 1);
      const lastCol   = columnToLetter(colCount);

      worksheet.mergeCells(`A1:${lastCol}1`);
      const titleCell = worksheet.getCell('A1');
      titleCell.value = safeMeta.title;
      titleCell.font  = { bold: true, size: 14 };
      titleCell.alignment = { horizontal: 'center' };

      worksheet.mergeCells(`A2:${lastCol}2`);
      const metaCell = worksheet.getCell('A2');
      metaCell.value = `Account: ${safeMeta.account} (${safeMeta.accountCode}) | Period: ${safeMeta.periodLabel} | Trunk: ${safeMeta.trunk}`;
      metaCell.font  = { italic: false, size: 10 };
      metaCell.alignment = { horizontal: 'center' };

      worksheet.mergeCells(`A3:${lastCol}3`);
      const genCell = worksheet.getCell('A3');
      genCell.value = `Generated: ${new Date(safeMeta.generatedAt).toLocaleString()}`;
      genCell.font  = { size: 9 };
      genCell.alignment = { horizontal: 'center' };

      const headerRowIndex = 5;
      const headerRow      = worksheet.getRow(headerRowIndex);
      headerRow.height     = 20;
      columns.forEach((key, idx) => {
        const colIdx = idx + 1;
        const cell   = headerRow.getCell(colIdx);
        cell.value   = String(key).toUpperCase();
        cell.font    = { bold: true };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEEE' } };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        worksheet.getColumn(colIdx).width = Math.max(12, Math.min(40, String(key).length + 10));
      });

      let currentRow = headerRowIndex + 1;
      for (let i = 0; i < data.length; i++) {
        const rowObj = data[i];
        const row    = worksheet.getRow(currentRow);
        columns.forEach((key, idx) => {
          const val = rowObj[key];
          row.getCell(idx + 1).value = val === null || val === undefined ? '' : val;
        });
        currentRow++;
      }

      const totals = {};
      let rowCount = 0;
      for (let i = 0; i < data.length; i++) {
        rowCount++;
        const rowObj = data[i];
        for (let c = 0; c < columns.length; c++) {
          const colName = columns[c];
          const v = rowObj[colName];
          const n = Number(v);
          if (!Number.isNaN(n) && typeof v !== 'object') {
            totals[colName] = (totals[colName] || 0) + n;
          }
        }
      }

      currentRow++;
      const summaryRow = worksheet.getRow(currentRow);
      summaryRow.getCell(1).value = 'SUMMARY';
      summaryRow.getCell(1).font  = { bold: true };
      summaryRow.getCell(1).fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7FAFC' } };

      for (let idx = 0; idx < columns.length; idx++) {
        const colName = columns[idx];
        const colNorm = normalize(colName);
        let rawValue  = '';
        let label     = '';

        if (['attempts', 'calls', 'totalcalls', 'total_calls'].some((k) => colNorm === k || colNorm.includes(k))) {
          label = 'Total Calls :-'; rawValue = totals[colName] ?? 0;
        } else if (['completed', 'comp', 'answeredcalls'].some((k) => colNorm === k || colNorm.includes(k))) {
          label = 'Completed Calls :-'; rawValue = totals[colName] ?? 0;
        } else if (colNorm.includes('revenue') || colNorm.includes('rev') || colNorm.includes('amount')) {
          label = 'Total Revenue :-'; rawValue = totals[colName] ?? 0;
        } else if (colNorm.includes('cost') && !colNorm.includes('costper')) {
          label = 'Total Cost :-'; rawValue = totals[colName] ?? 0;
        } else if (colNorm.includes('margin') && !colNorm.includes('marginpercent')) {
          label = 'Total Margin :-'; rawValue = totals[colName] ?? 0;
        } else if (colNorm === 'duration' || colNorm.includes('duration') || colNorm.includes('acd')) {
          label = 'Total Duration :-'; rawValue = totals[colName] ?? 0;
        } else if (colNorm === 'asr' || colNorm.includes('asr')) {
          label = 'Avg ASR :-';
          const attemptsKey  = Object.keys(totals).find((k) => normalize(k).includes('attempt'));
          const completedKey = Object.keys(totals).find((k) => normalize(k).includes('completed') || normalize(k).includes('comp'));
          const attemptsSum  = attemptsKey  ? totals[attemptsKey]  : undefined;
          const completedSum = completedKey ? totals[completedKey] : undefined;
          if (attemptsSum > 0 && completedSum >= 0) {
            rawValue = parseFloat(((completedSum / attemptsSum) * 100).toFixed(6));
          } else if (totals[colName] !== undefined) {
            rawValue = parseFloat((totals[colName] / rowCount).toFixed(6));
          }
        } else if (totals[colName] !== undefined) {
          label = 'Total :-'; rawValue = totals[colName];
        }

        if (rawValue !== '' && rawValue !== undefined) {
          const cell      = summaryRow.getCell(idx + 1);
          const formatted = typeof rawValue === 'number' ? Number(rawValue).toFixed(4) : String(rawValue);
          cell.value      = `${label} ${formatted}`.trim();
          cell.font       = { bold: true };
          cell.alignment  = { horizontal: 'right' };
        }
      }

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=${fileName || 'report'}.xlsx`);
      await workbook.xlsx.write(res);
      res.end();

    } else {
      const json2csvParser = new Parser({ fields: columns, quote: '"' });
      const topLines = [
        safeMeta.title,
        `Account: ${safeMeta.account} (${safeMeta.accountCode})`,
        `Period: ${safeMeta.periodLabel}`,
        `Trunk: ${safeMeta.trunk}`,
        `Generated: ${new Date(safeMeta.generatedAt).toLocaleString()}`,
        '',
      ];
      const csvBody = json2csvParser.parse(data);

      const totalsCsv = {};
      let csvRowCount = 0;
      for (let i = 0; i < data.length; i++) {
        csvRowCount++;
        const rowObj = data[i];
        for (let c = 0; c < columns.length; c++) {
          const colName = columns[c];
          const v = rowObj[colName];
          const n = Number(v);
          if (!Number.isNaN(n) && typeof v !== 'object') {
            totalsCsv[colName] = (totalsCsv[colName] || 0) + n;
          }
        }
      }

      const summaryRowArr = Array(columns.length).fill('');
      summaryRowArr[0] = 'SUMMARY';

      for (let i = 0; i < columns.length; i++) {
        const colName = columns[i];
        const colNorm = normalize(colName);
        let rawValue  = '';
        let label     = '';

        if (['attempts', 'calls', 'totalcalls', 'total_calls'].some((k) => colNorm === k || colNorm.includes(k))) {
          label = 'Total Calls :-'; rawValue = totalsCsv[colName] ?? '';
        } else if (['completed', 'comp', 'answeredcalls'].some((k) => colNorm === k || colNorm.includes(k))) {
          label = 'Completed Calls :-'; rawValue = totalsCsv[colName] ?? '';
        } else if (colNorm.includes('revenue') || colNorm.includes('rev') || colNorm.includes('amount')) {
          label = 'Total Revenue :-'; rawValue = totalsCsv[colName] ?? '';
        } else if (colNorm.includes('cost') && !colNorm.includes('costper')) {
          label = 'Total Cost :-'; rawValue = totalsCsv[colName] ?? '';
        } else if (colNorm.includes('margin') && !colNorm.includes('marginpercent')) {
          label = 'Total Margin :-'; rawValue = totalsCsv[colName] ?? '';
        } else if (colNorm === 'duration' || colNorm.includes('duration') || colNorm.includes('acd')) {
          label = 'Total Duration :-'; rawValue = totalsCsv[colName] ?? '';
        } else if (colNorm === 'asr' || colNorm.includes('asr')) {
          label = 'Avg ASR :-';
          const attemptsKey  = Object.keys(totalsCsv).find((k) => normalize(k).includes('attempt'));
          const completedKey = Object.keys(totalsCsv).find((k) => normalize(k).includes('completed') || normalize(k).includes('comp'));
          const attemptsSum  = attemptsKey  ? totalsCsv[attemptsKey]  : undefined;
          const completedSum = completedKey ? totalsCsv[completedKey] : undefined;
          if (attemptsSum > 0 && completedSum >= 0) {
            rawValue = parseFloat(((completedSum / attemptsSum) * 100).toFixed(6));
          } else if (totalsCsv[colName] !== undefined) {
            rawValue = parseFloat((totalsCsv[colName] / csvRowCount).toFixed(6));
          }
        } else if (totalsCsv[colName] !== undefined) {
          label = 'Total :-'; rawValue = totalsCsv[colName];
        }

        if (rawValue !== '' && rawValue !== undefined) {
          const formatted = typeof rawValue === 'number' ? Number(rawValue).toFixed(4) : String(rawValue);
          summaryRowArr[i] = `${label} ${formatted}`.trim();
        }
      }

      const csvEscape = (v) => {
        if (v === null || v === undefined) return '';
        const s = String(v).replace(/"/g, '""');
        return `"${s}"`;
      };

      const summaryCsvLine = summaryRowArr.map(csvEscape).join(',');
      const finalCsv       = [...topLines, csvBody, '', summaryCsvLine].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=${fileName || 'report'}.csv`);
      res.status(200).send(finalCsv);
    }
  } catch (e) {
    console.error('Export Report Error:', e);
    res.status(500).json({ error: e.message });
  }
};

/* ===================== EXPORT SOA ===================== */
exports.exportSOA = async (req, res) => {
  try {
    const { account, startDate, endDate } = req.body;

    if (!account) return res.status(400).json({ error: 'Account is required' });

    const { accountName, customerCode, vendorCode } = account;
    const normalizedRole         = String(account.accountRole || '').toLowerCase();
    const includeCustomer        = normalizedRole ? ['customer', 'both'].includes(normalizedRole) : Boolean(customerCode);
    const includeVendor          = normalizedRole ? ['vendor',   'both'].includes(normalizedRole) : Boolean(vendorCode);
    const vendorPaymentDirection = normalizedRole === 'vendor' ? 'inbound' : 'outbound';

    if (!includeCustomer && !includeVendor) {
      return res.status(400).json({ error: 'Account role does not support SOA generation' });
    }

    const normalizedStartDate = String(startDate || '').trim();
    const normalizedEndDate   = String(endDate   || '').trim();
    const start = normalizedStartDate ? new Date(normalizedStartDate) : new Date(0);
    const end   = normalizedEndDate   ? new Date(normalizedEndDate)   : new Date();
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return res.status(400).json({ error: 'Invalid date range' });
    }
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    const startTs  = start.getTime();
    const endTs    = end.getTime();
    const startYmd = normalizedStartDate;
    const endYmd   = normalizedEndDate;

    const vendorInvoiceWhere = { vendorCode };
    const vendorDateConditions = [];
    if (endYmd)   vendorDateConditions.push({ startDate: { [Op.lte]: endYmd } });
    if (startYmd) vendorDateConditions.push({ endDate:   { [Op.gte]: startYmd } });
    if (vendorDateConditions.length > 0) vendorInvoiceWhere[Op.and] = vendorDateConditions;

    const [customerInvoices, customerPayments, vendorInvoices, vendorPayments] = await Promise.all([
      includeCustomer && customerCode
        ? Invoice.findAll({ where: { customerCode, invoiceDate: { [Op.between]: [startTs, endTs] } }, order: [['invoiceDate', 'ASC']], raw: true })
        : Promise.resolve([]),
      includeCustomer && customerCode
        ? Payment.findAll({ where: { customerCode, partyType: 'customer', paymentDirection: 'inbound', paymentDate: { [Op.between]: [startTs, endTs] } }, order: [['paymentDate', 'ASC']], raw: true })
        : Promise.resolve([]),
      includeVendor && vendorCode
        ? VendorInvoice.findAll({ where: vendorInvoiceWhere, order: [['createdAt', 'ASC']], raw: true })
        : Promise.resolve([]),
      includeVendor && vendorCode
        ? Payment.findAll({ where: { customerCode: vendorCode, partyType: 'vendor', paymentDirection: vendorPaymentDirection, paymentDate: { [Op.between]: [startTs, endTs] } }, order: [['paymentDate', 'ASC']], raw: true })
        : Promise.resolve([]),
    ]);

    const disputes = vendorInvoices
      .filter((inv) => String(inv.status || '').toLowerCase() === 'disputed')
      .map((inv) => ({
        invoiceNumber: inv.invoiceNumber,
        disputeAmount: Number(inv.disputeDetails?.disputedAmount || inv.grandTotal || 0),
        status: 'open',
      }));

    const workbook  = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('SOA');

    const fmtDate = (ts) => {
      if (!ts) return '';
      return new Date(Number(ts)).toLocaleDateString('en-GB');
    };

    worksheet.mergeCells('J2:K2');
    const mainHeader = worksheet.getCell('J2');
    mainHeader.value = 'INVOICE OFFSETTING';
    mainHeader.font  = { bold: true, size: 12 };
    mainHeader.alignment = { horizontal: 'center' };

    worksheet.mergeCells('A4:C4');
    const leftInvoiceHeader = worksheet.getCell('A4');
    leftInvoiceHeader.value = includeCustomer ? 'Cyvoratech Pvt Ltd. INVOICE' : '';
    leftInvoiceHeader.font  = { bold: true };
    leftInvoiceHeader.alignment = { horizontal: 'center' };

    worksheet.mergeCells('F4:G4');
    const leftPaymentHeader = worksheet.getCell('F4');
    leftPaymentHeader.value = includeCustomer ? `${accountName} PAYMENT` : '';
    leftPaymentHeader.font  = { bold: true };
    leftPaymentHeader.alignment = { horizontal: 'center' };

    worksheet.mergeCells('I4:K4');
    const rightInvoiceHeader = worksheet.getCell('I4');
    rightInvoiceHeader.value = includeVendor ? `${accountName} INVOICE` : '';
    rightInvoiceHeader.font  = { bold: true };
    rightInvoiceHeader.alignment = { horizontal: 'center' };

    worksheet.mergeCells('N4:O4');
    const rightPaymentHeader = worksheet.getCell('N4');
    rightPaymentHeader.value = includeVendor
      ? vendorPaymentDirection === 'inbound' ? `${accountName} PAYMENT` : 'Cyvoratech Pvt Ltd. PAYMENT'
      : '';
    rightPaymentHeader.font  = { bold: true };
    rightPaymentHeader.alignment = { horizontal: 'center' };

    const headers = {};
    if (includeCustomer) {
      headers[1] = 'INVOICE NO'; headers[2] = 'PERIOD COVERED'; headers[3] = 'AMOUNT';
      headers[4] = 'PENDING DISPUTE'; headers[6] = 'DATE';
      headers[7] = `${accountName} PAYMENT`; headers[8] = 'BALANCE';
    }
    if (includeVendor) {
      headers[9]  = 'INVOICE NO'; headers[10] = 'PERIOD COVERED'; headers[11] = 'AMOUNT';
      headers[12] = 'PENDING DISPUTE'; headers[14] = 'DATE';
      headers[15] = vendorPaymentDirection === 'inbound' ? `${accountName} PAYMENT` : 'Cyvoratech Pvt Ltd. PAYMENT';
    }

    const headerRow = worksheet.getRow(5);
    Object.entries(headers).forEach(([col, val]) => {
      const cell = headerRow.getCell(Number(col));
      cell.value = val;
      cell.font  = { bold: true, size: 9 };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });

    const maxRows = Math.max(customerInvoices.length, customerPayments.length, vendorInvoices.length, vendorPayments.length);
    let currentRow = 6;
    let totalCustInv = 0, totalCustPay = 0, totalVendInv = 0, totalVendPay = 0;

    for (let i = 0; i < maxRows; i++) {
      const row = worksheet.getRow(currentRow);

      if (includeCustomer && customerInvoices[i]) {
        row.getCell(1).value = customerInvoices[i].invoiceNumber;
        row.getCell(2).value = `${fmtDate(customerInvoices[i].billingPeriodStart)}-${fmtDate(customerInvoices[i].billingPeriodEnd)}`;
        row.getCell(3).value = Number(customerInvoices[i].totalAmount);
        row.getCell(3).numFmt = '#,##0.0000';
        totalCustInv += Number(customerInvoices[i].totalAmount);
        const dispute = disputes.find((d) => d.invoiceNumber && d.invoiceNumber.includes(customerInvoices[i].invoiceNumber));
        if (dispute) { row.getCell(4).value = Number(dispute.disputeAmount); row.getCell(4).numFmt = '#,##0.0000'; }
      }

      if (includeCustomer && customerPayments[i]) {
        row.getCell(6).value = fmtDate(customerPayments[i].paymentDate);
        row.getCell(7).value = Number(customerPayments[i].amount);
        row.getCell(7).numFmt = '#,##0.0000';
        totalCustPay += Number(customerPayments[i].amount);
      }

      if (includeVendor && vendorInvoices[i]) {
        row.getCell(9).value  = vendorInvoices[i].invoiceNumber;
        row.getCell(10).value = `${vendorInvoices[i].startDate || ''}-${vendorInvoices[i].endDate || ''}`;
        row.getCell(11).value = Number(vendorInvoices[i].grandTotal || 0);
        row.getCell(11).numFmt = '#,##0.0000';
        totalVendInv += Number(vendorInvoices[i].grandTotal || 0);
      }

      if (includeVendor && vendorPayments[i]) {
        row.getCell(14).value = fmtDate(vendorPayments[i].paymentDate);
        row.getCell(15).value = Number(vendorPayments[i].amount);
        row.getCell(15).numFmt = '#,##0.0000';
        totalVendPay += Number(vendorPayments[i].amount);
      }

      [1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 14, 15].forEach((col) => {
        row.getCell(col).border = { left: { style: 'thin' }, right: { style: 'thin' } };
      });

      currentRow++;
    }

    const totalRow = worksheet.getRow(currentRow);
    totalRow.getCell(3).value  = totalCustInv;
    totalRow.getCell(7).value  = totalCustPay;
    totalRow.getCell(8).value  = totalCustInv - totalCustPay;
    totalRow.getCell(11).value = totalVendInv;
    totalRow.getCell(15).value = totalVendPay;
    [3, 7, 8, 11, 15].forEach((col) => {
      totalRow.getCell(col).numFmt = '#,##0.0000';
      totalRow.getCell(col).font  = { bold: true };
      totalRow.getCell(col).border = { top: { style: 'thin' }, bottom: { style: 'double' }, left: { style: 'thin' }, right: { style: 'thin' } };
    });

    currentRow += 3;
    worksheet.mergeCells(`B${currentRow}:C${currentRow}`);
    const balanceLabel = worksheet.getCell(`B${currentRow}`);
    balanceLabel.value = 'BALANCE AFTER OFFSET:';
    balanceLabel.font  = { bold: true };
    balanceLabel.alignment = { horizontal: 'right' };

    const balanceValue = worksheet.getCell(`H${currentRow}`);
    balanceValue.value  = (totalCustInv - totalCustPay) - (totalVendInv - totalVendPay);
    balanceValue.numFmt = '#,##0.0000';
    balanceValue.font   = { bold: true };
    balanceValue.border = { bottom: { style: 'thin' } };

    worksheet.mergeCells(`I${currentRow}:K${currentRow}`);
    const broughtForwardLabel = worksheet.getCell(`I${currentRow}`);
    broughtForwardLabel.value = 'BALANCE BROUGHT FORWARD:';
    broughtForwardLabel.font  = { bold: true };
    broughtForwardLabel.alignment = { horizontal: 'right' };

    worksheet.columns = [
      { width: 15 }, { width: 22 }, { width: 12 }, { width: 15 }, { width: 4 },
      { width: 12 }, { width: 22 }, { width: 15 }, { width: 15 }, { width: 22 },
      { width: 12 }, { width: 15 }, { width: 4  }, { width: 12 }, { width: 25 },
    ];

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=SOA_${accountName}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();

  } catch (e) {
    console.error('Export SOA Error:', e);
    res.status(500).json({ error: e.message });
  }
};

/* ===================== SEND SOA EMAIL ===================== */
exports.sendSOAEmail = async (req, res) => {
  try {
    const { account, startDate, endDate } = req.body;

    if (!account) return res.status(400).json({ error: 'Account is required' });

    const { accountName, customerCode, vendorCode } = account;
    const normalizedRole         = String(account.accountRole || '').toLowerCase();
    const includeCustomer        = normalizedRole ? ['customer', 'both'].includes(normalizedRole) : Boolean(customerCode);
    const includeVendor          = normalizedRole ? ['vendor',   'both'].includes(normalizedRole) : Boolean(vendorCode);
    const vendorPaymentDirection = normalizedRole === 'vendor' ? 'inbound' : 'outbound';

    if (!includeCustomer && !includeVendor) {
      return res.status(400).json({ error: 'Account role does not support SOA generation' });
    }

    const start = startDate ? new Date(startDate).getTime() : 0;
    const end   = endDate   ? new Date(endDate).getTime()   : Date.now();

    const normalizedStartDate = String(startDate || '').trim();
    const normalizedEndDate   = String(endDate   || '').trim();
    const vendorInvoiceWhere  = { vendorCode };
    const vendorDateConditions = [];
    if (normalizedEndDate)   vendorDateConditions.push({ startDate: { [Op.lte]: normalizedEndDate } });
    if (normalizedStartDate) vendorDateConditions.push({ endDate:   { [Op.gte]: normalizedStartDate } });
    if (vendorDateConditions.length > 0) vendorInvoiceWhere[Op.and] = vendorDateConditions;

    const [customerInvoices, customerPayments, vendorInvoices, vendorPayments] = await Promise.all([
      includeCustomer && customerCode
        ? Invoice.findAll({ where: { customerCode, invoiceDate: { [Op.between]: [start, end] } }, order: [['invoiceDate', 'ASC']], raw: true })
        : Promise.resolve([]),
      includeCustomer && customerCode
        ? Payment.findAll({ where: { customerCode, partyType: 'customer', paymentDirection: 'inbound', paymentDate: { [Op.between]: [start, end] } }, order: [['paymentDate', 'ASC']], raw: true })
        : Promise.resolve([]),
      includeVendor && vendorCode
        ? VendorInvoice.findAll({ where: vendorInvoiceWhere, order: [['createdAt', 'ASC']], raw: true })
        : Promise.resolve([]),
      includeVendor && vendorCode
        ? Payment.findAll({ where: { customerCode: vendorCode, partyType: 'vendor', paymentDirection: vendorPaymentDirection, paymentDate: { [Op.between]: [start, end] } }, order: [['paymentDate', 'ASC']], raw: true })
        : Promise.resolve([]),
    ]);

    const disputes = vendorInvoices
      .filter((inv) => String(inv.status || '').toLowerCase() === 'disputed')
      .map((inv) => ({
        invoiceNumber: inv.invoiceNumber,
        disputeAmount: Number(inv.disputeDetails?.disputedAmount || inv.grandTotal || 0),
        status: 'open',
      }));

    const accountDetails = await Account.findOne({
      where: {
        [Op.or]: [
          { customerCode },
          { vendorCode },
          { accountName },
        ],
      },
    });

    if (!accountDetails) return res.status(404).json({ error: 'Account not found' });

    const soaData = {
      customerInvoices, customerPayments, vendorInvoices, vendorPayments, disputes,
      totals: {
        customerRevenue:  customerInvoices.reduce((s, inv) => s + Number(inv.totalAmount || 0), 0),
        customerPayments: customerPayments.reduce((s, pay) => s + Number(pay.amount     || 0), 0),
        vendorCosts:      vendorInvoices.reduce((s, inv)   => s + Number(inv.grandTotal || 0), 0),
        vendorPayments:   vendorPayments.reduce((s, pay)   => s + Number(pay.amount     || 0), 0),
      },
    };

    const formattedStartDate = startDate ? new Date(startDate).toLocaleDateString('en-GB') : 'All time';
    const formattedEndDate   = endDate   ? new Date(endDate).toLocaleDateString('en-GB')   : 'Present';

    await EmailService.sendSOAEmail(accountDetails, formattedStartDate, formattedEndDate, soaData);
    const recipients = EmailService.getSOARecipients(accountDetails);

    res.json({ success: true, message: `SOA email sent successfully to ${recipients.join(', ')}` });

  } catch (e) {
    console.error('Send SOA Email Error:', e);
    res.status(500).json({ error: e.message });
  }
};