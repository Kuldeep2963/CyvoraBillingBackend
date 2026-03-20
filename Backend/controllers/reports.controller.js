const { Op, fn, col } = require('sequelize');
const sequelize = require('../models/db');
const CDR = require('../models/CDR');
const Account = require('../models/Account');
const User = require('../models/User');
const CountryCode = require('../models/CountryCode');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const PaymentAllocation = require('../models/PaymentAllocation');
const Dispute = require('../models/Dispute');
const H = require('../utils/reportHelper');
const { secondsToMMSS } = require('../utils/timeUtils');
const ExcelJS = require('exceljs');
const { Parser } = require('json2csv');
const EmailService = require('../services/EmailService');

/* ===================== COUNTRY CODE CACHE ===================== */
let countryCodesCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

const getCountryCodes = async () => {
  if (!countryCodesCache || (Date.now() - cacheTimestamp > CACHE_DURATION)) {
    countryCodesCache = await CountryCode.findAll({ raw: true });
    cacheTimestamp = Date.now();
    console.log('Country codes cache refreshed');
  }
  return countryCodesCache;
};

/* ===================== HELPER: FORMAT TIME ===================== */
const formatTime = (date, hour, minute = 0, isEnd = false) => {
  if (!date) return null;

  // Parse the date - handle both string dates and timestamps
  const numericDate = Number(date);
  let d;
  
  if (!isNaN(numericDate) && numericDate > 0) {
    // It's a timestamp in milliseconds
    d = new Date(numericDate);
  } else {
    // It's a date string like "2026-03-13"
    d = new Date(date);
  }
  
  if (isNaN(d.getTime())) return null;

  if (isEnd) {
    // For end range: go to end of that minute (59 seconds, 999 milliseconds)
    d.setHours(hour, minute, 59, 999);
  } else {
    // For start range: go to start of that minute (00 seconds, 000 milliseconds)
    d.setHours(hour, minute, 0, 0);
  }
  
  // Return Unix timestamp in milliseconds as a number (database field is bigint)
  return d.getTime();
};

/* ===================== HELPER: GET COUNTRY FROM NUMBER ===================== */
const getCountryFromNumber = (number, countryCodes, skipPrefix = false) => {
  if (!number) return 'Unknown';
  let cleaned = number.toString().replace(/^(\+|00)/, '');
  
  // Skip first 5 digits if this is a callee number (vendor destination)
  if (skipPrefix && cleaned.length > 5) {
    cleaned = cleaned.substring(5);
  }
  
  const sortedCodes = [...countryCodes].sort((a, b) => b.code.length - a.code.length);

  for (const cc of sortedCodes) {
    if (cleaned.startsWith(cc.code)) {
      return cc.country_name;
    }
  }
  return 'Unknown';
};

/* ===================== HELPER: BUILD ACCOUNT CONDITIONS ===================== */
const buildAccountConditions = (account, vendorReport) => {
  const or = [];

  // Determine which authentication fields to use
  const authType = vendorReport 
    ? (account.vendorauthenticationType || account.customerauthenticationType) 
    : account.customerauthenticationType;
  const authValue = vendorReport 
    ? (account.vendorauthenticationValue || account.customerauthenticationValue) 
    : account.customerauthenticationValue;

  // 1️⃣ IP authentication
  if (authType === 'ip' && authValue) {
    if (vendorReport) {
      // For vendor reports, we check calleeip (where we send calls)
      or.push({ calleeip: authValue });
    } else {
      // For customer reports, we check callerip (where calls come from)
      or.push({ callerip: authValue });
    }
  }

  // 2️⃣ Custom authentication → search in account fields
  if (authType === 'custom' && authValue) {
    const v = `${authValue}`;
    if (vendorReport) {
      or.push({ agentaccount: { [Op.like]: v } });
      or.push({ agentname: { [Op.like]: v } });
    } else {
      or.push({ customeraccount: { [Op.like]: v } });
      or.push({ customername: { [Op.like]: v } });
    }
  }

  // 3️⃣ Fallback to vendorCode/customerCode or gatewayId if nothing else matched
  if (or.length === 0) {
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

/* ===================== HELPER: BUILD WHERE CLAUSE ===================== */
const buildWhereClause = async (startDate, endDate, startHour, endHour, startMinute = 0, endMinute = 59, accountId, vendorReport) => {
  const startTs = Number(formatTime(startDate, startHour, startMinute));
  const endTs = Number(formatTime(endDate, endHour, endMinute, true));

  const where = {
    [Op.and]: [
      sequelize.literal(
        `CASE WHEN "CDR"."starttime"::text ~ '^[0-9]+$' THEN "CDR"."starttime"::bigint ELSE NULL END BETWEEN ${startTs} AND ${endTs}`
      )
    ]
  };

  if (!accountId || accountId === 'all') return where;

  // Look up account by ID (could be database ID or business identifier)
  let account = null;
  
  // First try to find by integer ID
  if (!isNaN(accountId) && accountId !== '') {
    account = await Account.findByPk(parseInt(accountId));
  }
  
  // If not found and accountId is a string, try business identifiers
  if (!account) {
    account = await Account.findOne({
      where: {
        [Op.or]: [
          { customerCode: String(accountId) },
          { vendorCode: String(accountId) },
          { accountId: String(accountId) }
        ]
      }
    });
  }

  if (!account) {
    console.warn('Account not found:', accountId);
    return where;
  }

  const conditions = buildAccountConditions(account, vendorReport);

  if (conditions.length) {
    where[Op.and].push({ [Op.or]: conditions });
  }

  return where;
};


/* ===================== HOURLY REPORT ===================== */
exports.hourlyReport = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      accountId = 'all',
      startHour = 0,
      startMinute = 0,
      endHour = 23,
      endMinute = 59,
      vendorReport = false,
      ownerName = ''
    } = req.body;

    const startTimeFormatted = formatTime(startDate, startHour, startMinute);
    const endTimeFormatted = formatTime(endDate, endHour, endMinute, true);

    console.log(' Hourly Report Request:', {
      startDate,
      endDate,
      time: `${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')} - ${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`,
      accountId,
      vendorReport,
      startTimeFormatted,
      endTimeFormatted
    });

    const where = await buildWhereClause(
      startDate,
      endDate,
      startHour,
      endHour,
      startMinute,
      endMinute,
      accountId,
      vendorReport
    );

    console.log(' Applied WHERE clause (time range):', {
      startTime: startTimeFormatted,
      endTime: endTimeFormatted,
      castedStartTimeFilter: true
    });

    // DB-level grouping by hour only (gross across selected dates)
    const rows = await CDR.findAll({
      attributes: [
        [H.hour, 'hour'],
        [fn('COUNT', col('*')), 'attempts'],
        [fn('SUM', H.completedCall), 'completed'],
        [fn('SUM', H.failedCall), 'failed'],
        [fn('SUM', H.durationSec), 'duration'],
        [fn('SUM', H.revenue), 'revenue'],
        [fn('SUM', H.cost), 'cost']
      ],
      where,
      group: ['hour'],
      order: [[H.hour, 'ASC']],
      raw: true
    });

    console.log(`Processed ${rows.length} raw hour groups`);

    // Safety aggregation in Node: guarantees one row per hour (0..23)
    const hourlyMap = new Map();

    for (const r of rows) {
      const hourRaw = String(r.hour ?? '').trim();
      const h = Number.parseInt(hourRaw, 10);
      if (Number.isNaN(h) || h < 0 || h > 23) continue;

      if (!hourlyMap.has(h)) {
        hourlyMap.set(h, {
          hour: h,
          attempts: 0,
          completed: 0,
          failed: 0,
          duration: 0,
          revenue: 0,
          cost: 0
        });
      }

      const agg = hourlyMap.get(h);
      agg.attempts += Number(r.attempts || 0);
      agg.completed += Number(r.completed || 0);
      agg.failed += Number(r.failed || 0);
      agg.duration += Number(r.duration || 0);
      agg.revenue += Number(r.revenue || 0);
      agg.cost += Number(r.cost || 0);
    }

    const data = Array.from(hourlyMap.values())
      .sort((a, b) => a.hour - b.hour)
      .map((r) => {
        const start = `${String(r.hour).padStart(2, '0')}:00`;
        const end = `${String((r.hour + 1) % 24).padStart(2, '0')}:00`;

        return {
          hour: `${start} - ${end}`,
          accountOwner: ownerName,
          attempts: r.attempts,
          completed: r.completed,
          asr: r.attempts > 0 ? parseFloat(((r.completed / r.attempts) * 100).toFixed(4)) : 0,
          acd: r.completed > 0 ? parseFloat((r.duration / r.completed).toFixed(4)) : 0,
          duration: r.duration,
          revenue: parseFloat(r.revenue.toFixed(4)),
          cost: parseFloat(r.cost.toFixed(4)),
          margin: parseFloat((r.revenue - r.cost).toFixed(4))
        };
      });

    if (data.length === 0) {
      return res.json({
        success: true,
        data: [],
        summary: {
          totalAttempts: 0,
          totalCompleted: 0,
          totalRevenue: 0,
          avgASR: 0
        },
        message: 'No CDR records found for the selected criteria'
      });
    }

    const totalAttempts = data.reduce((sum, r) => sum + r.attempts, 0);
    const totalCompleted = data.reduce((sum, r) => sum + r.completed, 0);
    const totalRevenue = data.reduce((sum, r) => sum + r.revenue, 0);

    res.json({
      success: true,
      data,
      summary: {
        totalAttempts,
        totalCompleted,
        totalRevenue,
        avgASR: totalAttempts > 0
          ? parseFloat(((totalCompleted / totalAttempts) * 100).toFixed(4))
          : 0
      }
    });
  } catch (e) {
    console.error('Hourly Report Error:', e);
    res.status(500).json({ error: e.message });
  }
};

/* ===================== MARGIN REPORT ===================== */
exports.marginReport = async (req, res) => {
  try {
    const { startDate, endDate, accountId = 'all', startHour = 0, startMinute = 0, endHour = 23, endMinute = 59, vendorReport = false, ownerName = '' } = req.body;
    const countryCodes = await getCountryCodes(); // ✅ Using cache

    console.log('Margin Report Request:', {
      startDate, endDate, accountId, startHour, startMinute, endHour, endMinute, vendorReport
    });

    const where = await buildWhereClause(startDate, endDate, startHour, endHour, startMinute, endMinute, accountId, vendorReport);

    // Get all CDRs with country information
    const cdrs = await CDR.findAll({
      attributes: [
        vendorReport ? 'agentaccount' : 'customeraccount',
        vendorReport ? 'agentname' : 'customername',
        'calleee164', // ✅ FIXED: Use callee for destination, not caller
        [fn('COUNT', col('*')), 'attempts'],
        [fn('SUM', H.completedCall), 'completed'],
        [fn('SUM', H.durationSec), 'duration'],
        [fn('SUM', H.revenue), 'revenue'],
        [fn('SUM', H.cost), 'cost']
      ],
      where,
      group: [
        vendorReport ? 'agentaccount' : 'customeraccount',
        vendorReport ? 'agentname' : 'customername',
        'calleee164'
      ],
      raw: true
    });

    if (cdrs.length === 0) {
      return res.json({
        success: true,
        data: [],
        summary: {
          totalRevenue: 0,
          totalCost: 0,
          totalMargin: 0,
          avgMarginPercent: 0
        },
        message: 'No CDR records found for the selected criteria'
      });
    }

    // Group by account and destination country
    const groupedData = {};
    
    cdrs.forEach(r => {
      const accountCode = vendorReport ? r.agentaccount : r.customeraccount;
      const accountName = vendorReport ? r.agentname : r.customername;
      
      // ✅ FIXED: Use calleee164 (destination) with prefix skip for vendor routing
      const destination = getCountryFromNumber(r.calleee164, countryCodes, true);
      
      const key = `${accountCode}|${destination}`;
      
      if (!groupedData[key]) {
        groupedData[key] = {
          accountCode,
          accountName,
          destination,
          attempts: 0,
          completed: 0,
          duration: 0,
          revenue: 0,
          cost: 0
        };
      }
      
      groupedData[key].attempts += Number(r.attempts);
      groupedData[key].completed += Number(r.completed);
      groupedData[key].duration += Number(r.duration);
      groupedData[key].revenue += Number(r.revenue);
      groupedData[key].cost += Number(r.cost);
    });

    console.log(`Processed ${cdrs.length} individual rows into ${Object.keys(groupedData).length} grouped rows`);

    const data = Object.values(groupedData).map(r => {
      const rev = r.revenue;
      const cst = r.cost;
      const margin = rev - cst;

      return {
        accountCode: r.accountCode,
        accountName: r.accountName,
        accountOwner: ownerName,
        destination: r.destination,
        attempts: r.attempts,
        completed: r.completed,
        asr: r.attempts > 0 ? parseFloat(((r.completed / r.attempts) * 100).toFixed(4)) : 0,
        acd: r.completed > 0 ? parseFloat((r.duration / r.completed).toFixed(4)) : 0,
        duration: r.duration,
        revenue: parseFloat(rev.toFixed(6)),
        cost: parseFloat(cst.toFixed(6)),
        margin: parseFloat(margin.toFixed(6)),
        marginPercent: rev > 0 ? parseFloat(((margin / rev) * 100).toFixed(4)) : 0
      };
    });

    res.json({
      success: true,
      data,
      summary: {
        totalRevenue: data.reduce((sum, r) => sum + r.revenue, 0),
        totalCost: data.reduce((sum, r) => sum + r.cost, 0),
        totalMargin: data.reduce((sum, r) => sum + r.margin, 0),
        avgMarginPercent: data.length > 0 ? parseFloat((data.reduce((sum, r) => sum + r.marginPercent, 0) / data.length).toFixed(4)) : 0
      }
    });

  } catch (e) {
    console.error('Margin Report Error:', e);
    res.status(500).json({ error: e.message });
  }
};

/* ===================== CUSTOMER TRAFFIC REPORT (customer-to-vendor) ===================== */
exports.customerTrafficReport = async (req, res) => {
  try {
    const { startDate, endDate, accountId = 'all', startHour = 0, startMinute = 0, endHour = 23, endMinute = 59, vendorReport = false, ownerName = '' } = req.body;
    const countryCodes = await getCountryCodes(); // ✅ Using cache

    console.log('Customer Traffic Report Request:', {
      startDate, endDate, accountId, startHour, startMinute, endHour, endMinute, vendorReport
    });

    const where = await buildWhereClause(startDate, endDate, startHour, endHour, startMinute, endMinute, accountId, vendorReport);

    // Get all CDRs grouped by individual numbers first
    const cdrs = await CDR.findAll({
      attributes: [
        'customeraccount', 'customername', 'callere164',
        'agentaccount', 'agentname', 'calleee164',
        [fn('COUNT', col('*')), 'attempts'],
        [fn('SUM', H.completedCall), 'completed'],
        [fn('SUM', H.durationSec), 'duration'],
        [fn('SUM', H.revenue), 'revenue'],
        [fn('SUM', H.cost), 'cost']
      ],
      where,
      group: [
        'customeraccount', 'customername', 'callere164',
        'agentaccount', 'agentname', 'calleee164'
      ],
      raw: true
    });

    if (cdrs.length === 0) {
      return res.json({
        success: true,
        data: [],
        summary: {
          totalCustomers: 0,
          totalAttempts: 0,
          totalRevenue: 0,
          avgASR: 0
        },
        message: 'No CDR records found for the selected criteria'
      });
    }

    // The ownerName is passed from the frontend (from getReportAccounts endpoint)
    // Simply use it directly - no need to fetch or map anything

    // Group by customer, vendor, and destination countries
    const groupedData = {};
    
    cdrs.forEach(r => {
      // Customer destination (caller origin) - no prefix skip
      const custCountry = getCountryFromNumber(r.callere164, countryCodes, false);
      // Vendor destination (callee/destination) - skip first 5 digits for routing prefix
      const vendCountry = getCountryFromNumber(r.calleee164, countryCodes, true);
      
      const key = `${r.customeraccount}|${r.agentaccount}|${custCountry}|${vendCountry}`;
      
      if (!groupedData[key]) {
        groupedData[key] = {
          customeraccount: r.customeraccount,
          customername: r.customername,
          custDestination: custCountry,
          agentaccount: r.agentaccount,
          agentname: r.agentname,
          vendDestination: vendCountry,
          attempts: 0,
          completed: 0,
          duration: 0,
          revenue: 0,
          cost: 0
        };
      }
      
      groupedData[key].attempts += Number(r.attempts);
      groupedData[key].completed += Number(r.completed);
      groupedData[key].duration += Number(r.duration);
      groupedData[key].revenue += Number(r.revenue);
      groupedData[key].cost += Number(r.cost);
    });

    console.log(`Processed ${cdrs.length} individual rows into ${Object.keys(groupedData).length} grouped rows`);

    const data = Object.values(groupedData).map(r => {
      const rev = r.revenue;
      const cst = r.cost;
      const margin = rev - cst;
      const dur = r.duration;
      const comp = r.completed;

      // Get the owner for this account (passed from frontend via ownerName param)
      const accountOwner = ownerName;

      return {
        custAccountCode: r.customeraccount,
        vendAccountCode: r.agentaccount,
        accountOwner: accountOwner,
        customer: r.customername,
        custDestination: r.custDestination,
        vendor: r.agentname,
        vendDestination: r.vendDestination,
        attempts: r.attempts,
        completed: comp,
        asr: r.attempts > 0 ? parseFloat(((comp / r.attempts) * 100).toFixed(4)) : 0,
        acd: comp > 0 ? parseFloat((dur / comp).toFixed(4)) : 0,
        rawDuration: dur,
        custRoundedDuration: comp > 0 ? parseFloat((dur / comp).toFixed(4)) : 0,
        vendRoundedDuration: comp > 0 ? parseFloat((dur / comp).toFixed(4)) : 0,
        revenue: parseFloat(rev.toFixed(6)),
        revenuePerMin: dur > 0 ? parseFloat((rev / (dur / 60)).toFixed(4)) : 0,
        cost: parseFloat(cst.toFixed(6)),
        costPerMin: dur > 0 ? parseFloat((cst / (dur / 60)).toFixed(4)) : 0,
        margin: parseFloat(margin.toFixed(6)),
        marginPerMin: dur > 0 ? parseFloat((margin / (dur / 60)).toFixed(4)) : 0,
        marginPercent: rev > 0 ? parseFloat(((margin / rev) * 100).toFixed(4)) : 0,
        failedCalls: r.attempts - comp,
      };
    });

    res.json({
      success: true,
      data,
      summary: {
        totalCustomers: [...new Set(data.map(r => r.customer))].length,
        totalAttempts: data.reduce((sum, r) => sum + r.attempts, 0),
        totalRevenue: data.reduce((sum, r) => sum + r.revenue, 0),
        totalCost: data.reduce((sum, r) => sum + (r.cost || 0), 0),
        avgASR: data.length > 0 ? parseFloat((data.reduce((sum, r) => sum + r.asr, 0) / data.length).toFixed(6)) : 0
      }
    });

  } catch (e) {
    console.error('Customer Traffic Report Error:', e);
    res.status(500).json({ error: e.message });
  }
};


/* ===================== CUSTOMER-ONLY TRAFFIC REPORT ===================== */
exports.customerOnlyTrafficReport = async (req, res) => {
  try {
    const { startDate, endDate, accountId = 'all', startHour = 0, startMinute = 0, endHour = 23, endMinute = 59, ownerName = '' } = req.body;
    const countryCodes = await getCountryCodes();

    console.log('Customer‑only Traffic Report Request:', {
      startDate, endDate, accountId, startHour, startMinute, endHour, endMinute
    });

    const where = await buildWhereClause(startDate, endDate, startHour, endHour, startMinute, endMinute, accountId, false);

    const cdrs = await CDR.findAll({
      attributes: [
        'customeraccount', 'customername', 'callere164',
        [fn('COUNT', col('*')), 'attempts'],
        [fn('SUM', H.completedCall), 'completed'],
        [fn('SUM', H.durationSec), 'duration'],
        [fn('SUM', H.revenue), 'revenue'],
        [fn('SUM', H.cost), 'cost']
      ],
      where,
      group: ['customeraccount', 'customername', 'callere164'],
      raw: true
    });

    if (cdrs.length === 0) {
      return res.json({
        success: true,
        data: [],
        summary: { totalCustomers: 0, totalAttempts: 0, totalRevenue: 0, avgASR: 0 },
        message: 'No CDR records found for the selected criteria'
      });
    }

    // The ownerName is passed from frontend (from getReportAccounts which includes owner info)
    // Simply use it directly
    const groupedData = {};
    cdrs.forEach(r => {
      const custCountry = getCountryFromNumber(r.callere164, countryCodes, false);
      const key = `${r.customeraccount}|${custCountry}`;
      if (!groupedData[key]) {
        groupedData[key] = {
          customeraccount: r.customeraccount,
          customername: r.customername,
          custDestination: custCountry,
          attempts: 0,
          completed: 0,
          duration: 0,
          revenue: 0,
          cost: 0
        };
      }
      groupedData[key].attempts += Number(r.attempts);
      groupedData[key].completed += Number(r.completed);
      groupedData[key].duration += Number(r.duration);
      groupedData[key].revenue += Number(r.revenue);
      groupedData[key].cost += Number(r.cost);
    });

    const data = Object.values(groupedData).map(r => {
      const rev = r.revenue;
      const cst = r.cost;
      const margin = rev - cst;
      const dur = r.duration;
      const comp = r.completed;
      return {
        custAccountCode: r.customeraccount,
        accountOwner: ownerName,
        customer: r.customername,
        custDestination: r.custDestination,
        attempts: r.attempts,
        completed: comp,
        asr: r.attempts > 0 ? parseFloat(((comp / r.attempts) * 100).toFixed(4)) : 0,
        acd: comp > 0 ? parseFloat((dur / comp).toFixed(4)) : 0,
        revenue: parseFloat(rev.toFixed(6)),
        cost: parseFloat(cst.toFixed(6)),
        margin: parseFloat(margin.toFixed(6)),
        marginPercent: rev > 0 ? parseFloat(((margin / rev) * 100).toFixed(4)) : 0
      };
    });

    res.json({
      success: true,
      data,
      summary: {
        totalCustomers: [...new Set(data.map(r => r.customer))].length,
        totalAttempts: data.reduce((sum, r) => sum + r.attempts, 0),
        totalRevenue: data.reduce((sum, r) => sum + r.revenue, 0),
        avgASR: data.length > 0 ? parseFloat((data.reduce((sum, r) => sum + r.asr, 0) / data.length).toFixed(6)) : 0
      }
    });
  } catch (e) {
    console.error('Customer‑only Traffic Error:', e);
    res.status(500).json({ error: e.message });
  }
};


/* ===================== VENDOR-ONLY TRAFFIC REPORT ===================== */
exports.vendorTrafficReport = async (req, res) => {
  try {
    const { startDate, endDate, accountId = 'all', startHour = 0, startMinute = 0, endHour = 23, endMinute = 59, ownerName = '' } = req.body;
    const countryCodes = await getCountryCodes();

    console.log('Vendor‑only Traffic Report Request:', {
      startDate, endDate, accountId, startHour, startMinute, endHour, endMinute
    });

    const where = await buildWhereClause(startDate, endDate, startHour, endHour, startMinute, endMinute, accountId, true);

    const cdrs = await CDR.findAll({
      attributes: [
        'agentaccount', 'agentname', 'calleee164',
        [fn('COUNT', col('*')), 'attempts'],
        [fn('SUM', H.completedCall), 'completed'],
        [fn('SUM', H.durationSec), 'duration'],
        [fn('SUM', H.revenue), 'revenue'],
        [fn('SUM', H.cost), 'cost']
      ],
      where,
      group: ['agentaccount', 'agentname', 'calleee164'],
      raw: true
    });

    if (cdrs.length === 0) {
      return res.json({
        success: true,
        data: [],
        summary: { totalVendors: 0, totalAttempts: 0, totalRevenue: 0, avgASR: 0 },
        message: 'No CDR records found for the selected criteria'
      });
    }

    // prepare owner map for vendor-only report
    // The ownerName is passed from frontend (from getReportAccounts which includes owner info)
    // Simply use it directly

    const groupedData = {};
    cdrs.forEach(r => {
      const vendCountry = getCountryFromNumber(r.calleee164, countryCodes, true);
      const key = `${r.agentaccount}|${vendCountry}`;
      if (!groupedData[key]) {
        groupedData[key] = {
          agentaccount: r.agentaccount,
          agentname: r.agentname,
          vendDestination: vendCountry,
          attempts: 0,
          completed: 0,
          duration: 0,
          revenue: 0,
          cost: 0
        };
      }
      groupedData[key].attempts += Number(r.attempts);
      groupedData[key].completed += Number(r.completed);
      groupedData[key].duration += Number(r.duration);
      groupedData[key].revenue += Number(r.revenue);
      groupedData[key].cost += Number(r.cost);
    });
    const data = Object.values(groupedData).map(r => {
      const rev = r.revenue;
      const cst = r.cost;
      const margin = rev - cst;
      const dur = r.duration;
      const comp = r.completed;
      return {
        vendAccountCode: r.agentaccount,
        accountOwner: ownerName,
        vendor: r.agentname,
        vendDestination: r.vendDestination,
        attempts: r.attempts,
        completed: comp,
        asr: r.attempts > 0 ? parseFloat(((comp / r.attempts) * 100).toFixed(4)) : 0,
        acd: comp > 0 ? parseFloat((dur / comp).toFixed(4)) : 0,
        revenue: parseFloat(rev.toFixed(6)),
        cost: parseFloat(cst.toFixed(6)),
        // calculate cost per minute similar to other reports
        costPerMin: dur > 0 ? parseFloat((cst / (dur / 60)).toFixed(6)) : 0,
        margin: parseFloat(margin.toFixed(6)),
        marginPercent: rev > 0 ? parseFloat(((margin / rev) * 100).toFixed(4)) : 0
      };
    });

    res.json({
      success: true,
      data,
      summary: {
        totalVendors: [...new Set(data.map(r => r.vendor))].length,
        totalAttempts: data.reduce((sum, r) => sum + r.attempts, 0),
        totalRevenue: data.reduce((sum, r) => sum + r.revenue, 0),
        totalCost: data.reduce((sum, r) => sum + r.cost, 0),
        avgASR: data.length > 0 ? parseFloat((data.reduce((sum, r) => sum + r.asr, 0) / data.length).toFixed(6)) : 0
      }
    });
  } catch (e) {
    console.error('Vendor‑only Traffic Error:', e);
    res.status(500).json({ error: e.message });
  }
};

/* ===================== NEGATIVE MARGIN REPORT ===================== */
exports.negativeMarginReport = async (req, res) => {
  try {
    const { startDate, endDate, accountId = 'all', startHour = 0, startMinute = 0, endHour = 23, endMinute = 59, vendorReport = false, ownerName = '' } = req.body;
    const countryCodes = await getCountryCodes(); // ✅ Using cache

    console.log('Negative Margin Report Request:', {
      startDate, endDate, accountId, startHour, startMinute, endHour, endMinute, vendorReport
    });

    const where = await buildWhereClause(startDate, endDate, startHour, endHour, startMinute, endMinute, accountId, vendorReport);

    // Get all CDRs grouped by individual numbers first
    const cdrs = await CDR.findAll({
      attributes: [
        vendorReport ? 'agentaccount' : 'customeraccount',
        vendorReport ? 'agentname' : 'customername',
        'calleee164', // ✅ FIXED: Use destination number
        [fn('COUNT', col('*')), 'attempts'],
        [fn('SUM', H.completedCall), 'completed'],
        [fn('SUM', H.durationSec), 'duration'],
        [fn('SUM', H.revenue), 'revenue'],
        [fn('SUM', H.cost), 'cost']
      ],
      where,
      group: [
        vendorReport ? 'agentaccount' : 'customeraccount',
        vendorReport ? 'agentname' : 'customername',
        'calleee164'
      ],
      raw: true
    });

    if (cdrs.length === 0) {
      return res.json({
        success: true,
        data: [],
        summary: {
          totalLoss: 0,
          negativeMarginCalls: 0,
          affectedCustomers: 0,
          affectedDestinations: 0
        },
        message: 'No CDR records found for the selected criteria'
      });
    }

    // Group by account and destination country
    const groupedData = {};
    
    cdrs.forEach(r => {
      const accountCode = vendorReport ? r.agentaccount : r.customeraccount;
      const accountName = vendorReport ? r.agentname : r.customername;
      
      // ✅ FIXED: Use calleee164 (destination) with prefix skip
      const destination = getCountryFromNumber(r.calleee164, countryCodes, true);
      
      const key = `${accountCode}|${destination}`;
      
      if (!groupedData[key]) {
        groupedData[key] = {
          accountCode,
          accountName,
          destination,
          attempts: 0,
          completed: 0,
          duration: 0,
          revenue: 0,
          cost: 0
        };
      }
      
      groupedData[key].attempts += Number(r.attempts);
      groupedData[key].completed += Number(r.completed);
      groupedData[key].duration += Number(r.duration);
      groupedData[key].revenue += Number(r.revenue);
      groupedData[key].cost += Number(r.cost);
    });

    console.log(`Processed ${cdrs.length} individual rows into ${Object.keys(groupedData).length} grouped rows, filtering for negative margin`);

    const data = Object.values(groupedData)
      .map(r => {
        const rev = r.revenue;
        const cst = r.cost;
        const margin = rev - cst;

        return {
          accountCode: r.accountCode,
          accountName: r.accountName,
          accountOwner: ownerName,
          destination: r.destination,
          attempts: r.attempts,
          completed: r.completed,
          asr: r.attempts > 0 ? parseFloat(((r.completed / r.attempts) * 100).toFixed(2)) : 0,
          acd: r.completed > 0 ? parseFloat((r.duration / r.completed).toFixed(4)) : 0,
          duration: r.duration,
          revenue: parseFloat(rev.toFixed(6)),
          cost: parseFloat(cst.toFixed(6)),
          margin: parseFloat(margin.toFixed(6)),
          marginPercent: rev > 0 ? parseFloat(((margin / rev) * 100).toFixed(4)) : 0
        };
      })
      .filter(r => r.margin < 0);

    res.json({
      success: true,
      data,
      summary: {
        totalLoss: data.reduce((sum, r) => sum + r.margin, 0),
        negativeMarginCalls: data.reduce((sum, r) => sum + r.attempts, 0),
        affectedCustomers: [...new Set(data.map(r => r.accountCode))].length,
        affectedDestinations: [...new Set(data.map(r => r.destination))].length
      }
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
    
    console.log('Debug Mapping Request:', { accountId, vendorReport });
    
    if (!accountId || accountId === 'all') {
      return res.json({
        success: true,
        message: 'No specific account selected',
        sampleCdrs: await CDR.findAll({
          limit: 5,
          attributes: ['customeraccount', 'agentaccount', 'customername', 'agentname', 'starttime'],
          raw: true
        })
      });
    }

    // Try to find account - first by ID, then by business identifiers
    let account = null;
    
    if (!isNaN(accountId) && accountId !== '') {
      account = await Account.findByPk(parseInt(accountId));
    }
    
    if (!account) {
      account = await Account.findOne({
        where: { 
          [Op.or]: [
            { [vendorReport ? 'vendorCode' : 'customerCode']: String(accountId) },
            { accountId: String(accountId) }
          ]
        }
      });
    }

    if (!account) {
      return res.json({
        success: false,
        message: `Account not found for ID: ${accountId}`
      });
    }

    // Build conditions using helper
    const conditions = buildAccountConditions(account, vendorReport);
    
    // Check if CDRs exist for these conditions
    let cdrs = [];
    if (conditions.length > 0) {
      cdrs = await CDR.findAll({
        where: { [Op.or]: conditions },
        limit: 5,
        attributes: ['customeraccount', 'agentaccount', 'customername', 'agentname', 'callerip', 'agentip', 'starttime'],
        raw: true
      });
    }

    res.json({
      success: true,
      account: {
        id: account.id,
        accountId: account.accountId,
        accountName: account.accountName,
        customerCode: account.customerCode,
        vendorCode: account.vendorCode,
        gatewayId: account.gatewayId,
        customerauthenticationType: account.customerauthenticationType,
        customerauthenticationValue: account.customerauthenticationValue,
        accountRole: account.accountRole,
        accountowner: account.accountOwner
      },
      conditions: conditions,
      sampleCdrs: cdrs,
      message: conditions.length > 0
        ? `Found ${cdrs.length} sample CDRs using ${account.customerauthenticationType} authentication`
        : 'No valid authentication conditions found'
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
        attributes: ['id', 'accountId', 'accountName', 'accountRole', 'customerCode', 'vendorCode', 'gatewayId','accountOwner','customerauthenticationType','customerauthenticationValue'],
        where: { active: true },
        order: [['accountName', 'ASC']],
        raw: true
      });

      // Fetch all owners for these accounts
      const ownerIds = [...new Set(accounts.filter(a => a.accountOwner).map(a => a.accountOwner))];
      const owners = ownerIds.length > 0
        ? await User.findAll({
            where: { id: { [Op.in]: ownerIds } },
            attributes: ['id', 'first_name', 'last_name'],
            raw: true
          })
        : [];
      const ownerMapByUserId = {};
      owners.forEach(o => {
        ownerMapByUserId[o.id] = `${o.first_name} ${o.last_name}`;
      });

      // Add owner name to each account
      const accountsWithOwners = accounts.map(a => ({
        ...a,
        ownerName: a.accountOwner ? ownerMapByUserId[a.accountOwner] || '' : ''
      }));

      const customers = accountsWithOwners.filter(a => ['customer', 'both'].includes(a.accountRole));
      const vendors = accountsWithOwners.filter(a => ['vendor', 'both'].includes(a.accountRole));

      res.json({
        success: true,
        customers,
        vendors
      });
    } catch (e) {
      console.error('Get Report Accounts Error:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  };

/* ===================== EXPORT REPORT ===================== */
exports.exportReport = async (req, res) => {
  try {
    const { data, format, fileName } = req.body;

    if (!data || !Array.isArray(data)) {
      return res.status(400).json({ error: 'Data is required and must be an array' });
    }

    if (format === 'excel') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Report');

      if (data.length > 0) {
        worksheet.columns = Object.keys(data[0]).map(key => ({
          header: key.charAt(0).toUpperCase() + key.slice(1),
          key: key,
          width: 20
        }));
        worksheet.addRows(data);
      }

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=${fileName || 'report'}.xlsx`
      );

      await workbook.xlsx.write(res);
      res.end();
    } else {
      const json2csvParser = new Parser();
      const csv = json2csvParser.parse(data);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=${fileName || 'report'}.csv`
      );
      res.status(200).send(csv);
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

    if (!account) {
      return res.status(400).json({ error: 'Account is required' });
    }

    const { accountName, customerCode, vendorCode } = account;

    // Dates for filtering
    const start = startDate ? new Date(startDate).getTime() : 0;
    const end = endDate ? new Date(endDate).getTime() : Date.now();

    // 1. Fetch Customer Invoices (Invoices we issue to them)
    const customerInvoices = await Invoice.findAll({
      where: {
        customerCode: customerCode,
        invoiceType: 'customer',
        invoiceDate: { [Op.between]: [start, end] }
      },
      order: [['invoiceDate', 'ASC']],
      raw: true
    });

    // 2. Fetch Customer Payments (Payments from them to us)
    const customerPayments = await Payment.findAll({
      where: {
        customerCode: customerCode,
        partyType: 'customer',
        paymentDirection: 'inbound',
        status: 'completed',
        paymentDate: { [Op.between]: [start, end] }
      },
      order: [['paymentDate', 'ASC']],
      raw: true
    });

    // 3. Fetch Vendor Invoices (Invoices they issue to us)
    const vendorInvoices = await Invoice.findAll({
      where: {
        customerCode: vendorCode,
        invoiceType: 'vendor',
        invoiceDate: { [Op.between]: [start, end] }
      },
      order: [['invoiceDate', 'ASC']],
      raw: true
    });

    // 4. Fetch Vendor Payments (Payments from us to them)
    const vendorPayments = await Payment.findAll({
      where: {
        customerCode: vendorCode,
        partyType: 'vendor',
        paymentDirection: 'outbound',
        status: 'completed',
        paymentDate: { [Op.between]: [start, end] }
      },
      order: [['paymentDate', 'ASC']],
      raw: true
    });

    // 5. Fetch Disputes
    const disputes = await Dispute.findAll({
      where: {
        customerCode: customerCode,
        status: { [Op.ne]: 'closed' }
      },
      raw: true
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('SOA');

    // Helper for date formatting
    const fmtDate = (ts) => {
      if (!ts) return '';
      const d = new Date(Number(ts));
      return d.toLocaleDateString('en-GB');
    };

    // --- MAIN HEADER ---
    worksheet.mergeCells('J2:K2');
    const mainHeader = worksheet.getCell('J2');
    mainHeader.value = 'INVOICE OFFSETTING';
    mainHeader.font = { bold: true, size: 12 };
    mainHeader.alignment = { horizontal: 'center' };

    // --- GROUP HEADERS (Row 4) ---
    // Left Group: Customer Usage (Pai INVOICE)
    worksheet.mergeCells('A4:C4');
    const leftInvoiceHeader = worksheet.getCell('A4');
    leftInvoiceHeader.value = 'Pai Telecommunications Ltd. INVOICE';
    leftInvoiceHeader.font = { bold: true };
    leftInvoiceHeader.alignment = { horizontal: 'center' };

    worksheet.mergeCells('F4:G4');
    const leftPaymentHeader = worksheet.getCell('F4');
    leftPaymentHeader.value = `${accountName} PAYMENT`;
    leftPaymentHeader.font = { bold: true };
    leftPaymentHeader.alignment = { horizontal: 'center' };

    // Right Group: Vendor Usage (Account INVOICE)
    worksheet.mergeCells('I4:K4');
    const rightInvoiceHeader = worksheet.getCell('I4');
    rightInvoiceHeader.value = `${accountName} INVOICE`;
    rightInvoiceHeader.font = { bold: true };
    rightInvoiceHeader.alignment = { horizontal: 'center' };

    worksheet.mergeCells('N4:O4');
    const rightPaymentHeader = worksheet.getCell('N4');
    rightPaymentHeader.value = `Pai Telecommunications Ltd. PAYMENT`;
    rightPaymentHeader.font = { bold: true };
    rightPaymentHeader.alignment = { horizontal: 'center' };

    // --- COLUMN HEADERS (Row 5) ---
    const headers = {
      1: 'INVOICE NO', 2: 'PERIOD COVERED', 3: 'AMOUNT', 4: 'PENDING DISPUTE',
      6: 'DATE', 7: `${accountName} PAYMENT`, 8: 'BALANCE',
      9: 'INVOICE NO', 10: 'PERIOD COVERED', 11: 'AMOUNT', 12: 'PENDING DISPUTE',
      14: 'DATE', 15: `Pai Telecommunications Ltd. PAYMENT`
    };

    const headerRow = worksheet.getRow(5);
    Object.entries(headers).forEach(([col, val]) => {
      const cell = headerRow.getCell(Number(col));
      cell.value = val;
      cell.font = { bold: true, size: 9 };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });

    // --- DATA FILLING ---
    const maxRows = Math.max(customerInvoices.length, customerPayments.length, vendorInvoices.length, vendorPayments.length);
    let currentRow = 6;

    let totalCustInv = 0;
    let totalCustPay = 0;
    let totalVendInv = 0;
    let totalVendPay = 0;

    for (let i = 0; i < maxRows; i++) {
      const row = worksheet.getRow(currentRow);
      
      // Customer Invoices
      if (customerInvoices[i]) {
        row.getCell(1).value = customerInvoices[i].invoiceNumber;
        row.getCell(2).value = `${fmtDate(customerInvoices[i].billingPeriodStart)}-${fmtDate(customerInvoices[i].billingPeriodEnd)}`;
        row.getCell(3).value = Number(customerInvoices[i].totalAmount);
        row.getCell(3).numFmt = '#,##0.0000';
        totalCustInv += Number(customerInvoices[i].totalAmount);
        
        // Check for dispute
        const dispute = disputes.find(d => d.invoiceNumber && d.invoiceNumber.includes(customerInvoices[i].invoiceNumber));
        if (dispute) {
          row.getCell(4).value = Number(dispute.disputeAmount);
          row.getCell(4).numFmt = '#,##0.0000';
        }
      }

      // Customer Payments
      if (customerPayments[i]) {
        row.getCell(6).value = fmtDate(customerPayments[i].paymentDate);
        row.getCell(7).value = Number(customerPayments[i].amount);
        row.getCell(7).numFmt = '#,##0.0000';
        totalCustPay += Number(customerPayments[i].amount);
      }

      // Vendor Invoices
      if (vendorInvoices[i]) {
        row.getCell(9).value = vendorInvoices[i].invoiceNumber;
        row.getCell(10).value = `${fmtDate(vendorInvoices[i].billingPeriodStart)}-${fmtDate(vendorInvoices[i].billingPeriodEnd)}`;
        row.getCell(11).value = Number(vendorInvoices[i].totalAmount);
        row.getCell(11).numFmt = '#,##0.0000';
        totalVendInv += Number(vendorInvoices[i].totalAmount);

        // Vendor side disputes (if any, though disputes model seems customer-centric in this DB)
      }

      // Vendor Payments
      if (vendorPayments[i]) {
        row.getCell(14).value = fmtDate(vendorPayments[i].paymentDate);
        row.getCell(15).value = Number(vendorPayments[i].amount);
        row.getCell(15).numFmt = '#,##0.0000';
        totalVendPay += Number(vendorPayments[i].amount);
      }

      // Add borders to cells with data
      [1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 14, 15].forEach(col => {
        row.getCell(col).border = {
          left: { style: 'thin' },
          right: { style: 'thin' }
        };
      });

      currentRow++;
    }

    // --- TOTALS ROW ---
    const totalRow = worksheet.getRow(currentRow);
    totalRow.getCell(3).value = totalCustInv;
    totalRow.getCell(7).value = totalCustPay;
    totalRow.getCell(8).value = totalCustInv - totalCustPay;
    totalRow.getCell(11).value = totalVendInv;
    totalRow.getCell(15).value = totalVendPay;
    
    [3, 7, 8, 11, 15].forEach(col => {
      totalRow.getCell(col).numFmt = '#,##0.0000';
      totalRow.getCell(col).font = { bold: true };
      totalRow.getCell(col).border = {
        top: { style: 'thin' },
        bottom: { style: 'double' },
        left: { style: 'thin' },
        right: { style: 'thin' }
      };
    });

    // --- FOOTER ---
    currentRow += 3;
    worksheet.mergeCells(`B${currentRow}:C${currentRow}`);
    const balanceLabel = worksheet.getCell(`B${currentRow}`);
    balanceLabel.value = 'BALANCE AFTER OFFSET:';
    balanceLabel.font = { bold: true };
    balanceLabel.alignment = { horizontal: 'right' };

    const balanceValue = worksheet.getCell(`H${currentRow}`);
    balanceValue.value = (totalCustInv - totalCustPay) - (totalVendInv - totalVendPay);
    balanceValue.numFmt = '#,##0.0000';
    balanceValue.font = { bold: true };
    balanceValue.border = { bottom: { style: 'thin' } };

    worksheet.mergeCells(`I${currentRow}:K${currentRow}`);
    const broughtForwardLabel = worksheet.getCell(`I${currentRow}`);
    broughtForwardLabel.value = 'BALANCE BROUGHT FORWARD:';
    broughtForwardLabel.font = { bold: true };
    broughtForwardLabel.alignment = { horizontal: 'right' };

    // --- FORMATTING ---
    worksheet.columns = [
      { width: 15 }, { width: 22 }, { width: 12 }, { width: 15 }, { width: 4 }, 
      { width: 12 }, { width: 22 }, { width: 15 }, { width: 15 }, { width: 22 }, 
      { width: 12 }, { width: 15 }, { width: 4 }, { width: 12 }, { width: 25 }
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

    if (!account) {
      return res.status(400).json({ error: 'Account is required' });
    }

    const { accountName, customerCode, vendorCode } = account;

    // Dates for filtering
    const start = startDate ? new Date(startDate).getTime() : 0;
    const end = endDate ? new Date(endDate).getTime() : Date.now();

    // 1. Fetch Customer Invoices (Invoices we issue to them)
    const customerInvoices = await Invoice.findAll({
      where: {
        customerCode: customerCode,
        invoiceType: 'customer',
        invoiceDate: { [Op.between]: [start, end] }
      },
      order: [['invoiceDate', 'ASC']],
      raw: true
    });

    // 2. Fetch Customer Payments (Payments from them to us)
    const customerPayments = await Payment.findAll({
      where: {
        customerCode: customerCode,
        partyType: 'customer',
        paymentDirection: 'inbound',
        status: 'completed',
        paymentDate: { [Op.between]: [start, end] }
      },
      order: [['paymentDate', 'ASC']],
      raw: true
    });

    // 3. Fetch Vendor Invoices (Invoices they issue to us)
    const vendorInvoices = await Invoice.findAll({
      where: {
        customerCode: vendorCode,
        invoiceType: 'vendor',
        invoiceDate: { [Op.between]: [start, end] }
      },
      order: [['invoiceDate', 'ASC']],
      raw: true
    });

    // 4. Fetch Vendor Payments (Payments from us to them)
    const vendorPayments = await Payment.findAll({
      where: {
        customerCode: vendorCode,
        partyType: 'vendor',
        paymentDirection: 'outbound',
        status: 'completed',
        paymentDate: { [Op.between]: [start, end] }
      },
      order: [['paymentDate', 'ASC']],
      raw: true
    });

    // 5. Fetch Disputes
    const disputes = await Dispute.findAll({
      where: {
        customerCode: customerCode,
        status: { [Op.ne]: 'closed' }
      },
      raw: true
    });

    // Get the full account details for email
    const accountDetails = await Account.findOne({
      where: {
        [Op.or]: [
          { customerCode: customerCode },
          { vendorCode: vendorCode },
          { accountName: accountName }
        ]
      }
    });

    if (!accountDetails) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Prepare SOA data for email template
    const soaData = {
      customerInvoices,
      customerPayments,
      vendorInvoices,
      vendorPayments,
      disputes,
      totals: {
        customerRevenue: customerInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0),
        customerPayments: customerPayments.reduce((sum, pay) => sum + Number(pay.amount || 0), 0),
        vendorCosts: vendorInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0),
        vendorPayments: vendorPayments.reduce((sum, pay) => sum + Number(pay.amount || 0), 0)
      }
    };

    // Format dates for email
    const formattedStartDate = startDate ? new Date(startDate).toLocaleDateString('en-GB') : 'All time';
    const formattedEndDate = endDate ? new Date(endDate).toLocaleDateString('en-GB') : 'Present';

    // Send the email
    await EmailService.sendSOAEmail(accountDetails, formattedStartDate, formattedEndDate, soaData);

    res.json({
      success: true,
      message: `SOA email sent successfully to ${accountDetails.billingEmail || accountDetails.email}`
    });

  } catch (e) {
    console.error('Send SOA Email Error:', e);
    res.status(500).json({ error: e.message });
  }
};