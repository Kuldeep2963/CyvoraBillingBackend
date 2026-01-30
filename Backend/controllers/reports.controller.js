const { Op, fn, col } = require('sequelize');
const CDR = require('../models/CDR');
const Account = require('../models/Account');
const CountryCode = require('../models/CountryCode');
const H = require('../utils/reportHelper');
const { secondsToMMSS } = require('../utils/timeUtils');
const ExcelJS = require('exceljs');
const { Parser } = require('json2csv');

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
const formatTime = (date, hour, isEnd = false) => {
  const d = new Date(date);
  d.setHours(hour, isEnd ? 59 : 0, isEnd ? 59 : 0, isEnd ? 999 : 0);
  
  // Convert to Unix timestamp in milliseconds (same format as CDR)
  return d.getTime().toString();
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

  // 1️⃣ IP authentication
  if (account.authenticationType === 'ip' && account.authenticationValue) {
    // For vendor reports, check agentip; for customer reports, check callerip
    if (vendorReport) {
      or.push({ agentip: account.authenticationValue });
    } else {
      or.push({ callerip: account.authenticationValue });
    }
  }

  // 2️⃣ Custom authentication → search entire CDR row
  // Note: This is slow - consider if you really need all these fields
  if (account.authenticationType === 'custom' && account.authenticationValue) {
    const v = `${account.authenticationValue}`;
    or.push(
      { customeraccount: { [Op.like]: v } },
      { agentaccount: { [Op.like]: v } },
      { callere164: { [Op.like]: v } },
      { calleee164: { [Op.like]: v } },
      { customername: { [Op.like]: v } },
      { agentname: { [Op.like]: v } }
    );
  }

  // 3️⃣ Gateway authentication (explicit)
  if (account.authenticationType === 'gateway' && account.gatewayId) {
    or.push(
      vendorReport
        ? { agentaccount: account.gatewayId }
        : { customeraccount: account.gatewayId }
    );
  }

  // 4️⃣ Fallback → use gatewayId if no specific auth rule matched
  if (or.length === 0 && account.gatewayId) {
    or.push(
      vendorReport
        ? { agentaccount: account.gatewayId }
        : { customeraccount: account.gatewayId }
    );
  }

  return or;
};

/* ===================== HELPER: BUILD WHERE CLAUSE ===================== */
const buildWhereClause = async (startDate, endDate, startHour, endHour, accountId, vendorReport) => {
  const where = {
    starttime: {
      [Op.between]: [
        formatTime(startDate, startHour),
        formatTime(endDate, endHour, true)
      ]
    }
  };

  if (!accountId || accountId === 'all') return where;

  const account = await Account.findOne({
    where: {
      [Op.or]: [
        { customerCode: accountId },
        { vendorCode: accountId },
        { accountId }
      ]
    }
  });

  if (!account) {
    console.warn('Account not found:', accountId);
    return where;
  }

  const conditions = buildAccountConditions(account, vendorReport);

  if (conditions.length) {
    where[Op.and] = [{ [Op.or]: conditions }];
  }

  return where;
};


/* ===================== HOURLY REPORT ===================== */
exports.hourlyReport = async (req, res) => {
  try {
    const { startDate, endDate, accountId = 'all', startHour = 0, endHour = 23, vendorReport = false } = req.body;

    console.log('Hourly Report Request:', {
      startDate, endDate, accountId, startHour, endHour, vendorReport
    });

    const where = await buildWhereClause(startDate, endDate, startHour, endHour, accountId, vendorReport);

    const rows = await CDR.findAll({
      attributes: [
        [H.hour, 'hour'],
        [H.reportDate, 'date'],
        [fn('COUNT', col('*')), 'attempts'],
        [fn('SUM', H.completedCall), 'completed'],
        [fn('SUM', H.failedCall), 'failed'],
        [fn('SUM', H.durationSec), 'duration'],
        [fn('SUM', H.revenue), 'revenue'],
        [fn('SUM', H.cost), 'cost']
      ],
      where,
      group: ['hour', 'date'],
      order: [[H.hour, 'ASC']],
      raw: true
    });

    console.log(`Processed ${rows.length} hour groups`);

    if (rows.length === 0) {
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

    const data = rows.map(r => {
      const h = parseInt(r.hour);
      const start = h.toString().padStart(2, '0') + ':00';
      const end = (h + 1).toString().padStart(2, '0') + ':00';
      return {
        hour: `${start} - ${end}`,
        attempts: Number(r.attempts),
        completed: Number(r.completed),
        asr: r.attempts > 0 ? parseFloat(((r.completed / r.attempts) * 100).toFixed(4)) : 0,
        acd: r.completed > 0 ? parseFloat((r.duration / r.completed).toFixed(4)) : 0,
        duration: Number(r.duration),
        revenue: parseFloat(Number(r.revenue).toFixed(6)),
        cost: parseFloat(Number(r.cost).toFixed(6)),
        margin: parseFloat((Number(r.revenue) - Number(r.cost)).toFixed(6))
      };
    });

    res.json({
      success: true,
      data,
      summary: {
        totalAttempts: data.reduce((sum, r) => sum + r.attempts, 0),
        totalCompleted: data.reduce((sum, r) => sum + r.completed, 0),
        totalRevenue: data.reduce((sum, r) => sum + r.revenue, 0),
        avgASR: data.length > 0 ? parseFloat((data.reduce((sum, r) => sum + r.asr, 0) / data.length).toFixed(4)) : 0
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
    const { startDate, endDate, accountId = 'all', startHour = 0, endHour = 23, vendorReport = false } = req.body;
    const countryCodes = await getCountryCodes(); // ✅ Using cache

    console.log('Margin Report Request:', {
      startDate, endDate, accountId, startHour, endHour, vendorReport
    });

    const where = await buildWhereClause(startDate, endDate, startHour, endHour, accountId, vendorReport);

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

/* ===================== CUSTOMER TRAFFIC REPORT ===================== */
exports.customerTrafficReport = async (req, res) => {
  try {
    const { startDate, endDate, accountId = 'all', startHour = 0, endHour = 23, vendorReport = false } = req.body;
    const countryCodes = await getCountryCodes(); // ✅ Using cache

    console.log('Customer Traffic Report Request:', {
      startDate, endDate, accountId, startHour, endHour, vendorReport
    });

    const where = await buildWhereClause(startDate, endDate, startHour, endHour, accountId, vendorReport);

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

      return {
        custAccountCode: r.customeraccount,
        customer: r.customername,
        custDestination: r.custDestination,
        vendAccountCode: r.agentaccount,
        vendor: r.agentname,
        vendDestination: r.vendDestination,
        attempts: r.attempts,
        completed: comp,
        asr: r.attempts > 0 ? parseFloat(((comp / r.attempts) * 100).toFixed(4)) : 0,
        acd: comp > 0 ? parseFloat((dur / comp).toFixed(4)) : 0,
        rawDuration: dur,
        custRoundedDuration: comp > 0 ? parseFloat((dur / comp).toFixed(4)) : 0,
        vendRoundedDuration: comp > 0 ? parseFloat((dur / comp).toFixed(4)) : 0,
        revenue: parseFloat(rev.toFixed(8)),
        revenuePerMin: dur > 0 ? parseFloat((rev / (dur / 60)).toFixed(6)) : 0,
        cost: parseFloat(cst.toFixed(8)),
        costPerMin: dur > 0 ? parseFloat((cst / (dur / 60)).toFixed(6)) : 0,
        margin: parseFloat(margin.toFixed(6)),
        marginPerMin: dur > 0 ? parseFloat((margin / (dur / 60)).toFixed(6)) : 0,
        marginPercent: rev > 0 ? parseFloat(((margin / rev) * 100).toFixed(6)) : 0,
        failedCalls: r.attempts - comp,
        custProductGroup: "",
        vendProductGroup: ""
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
    console.error('Customer Traffic Report Error:', e);
    res.status(500).json({ error: e.message });
  }
};

/* ===================== NEGATIVE MARGIN REPORT ===================== */
exports.negativeMarginReport = async (req, res) => {
  try {
    const { startDate, endDate, accountId = 'all', startHour = 0, endHour = 23, vendorReport = false } = req.body;
    const countryCodes = await getCountryCodes(); // ✅ Using cache

    console.log('Negative Margin Report Request:', {
      startDate, endDate, accountId, startHour, endHour, vendorReport
    });

    const where = await buildWhereClause(startDate, endDate, startHour, endHour, accountId, vendorReport);

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

    // Get account details
    const account = await Account.findOne({
      where: { 
        [vendorReport ? 'vendorCode' : 'customerCode']: accountId 
      }
    });

    if (!account) {
      // Try by accountId
      const accountById = await Account.findOne({
        where: { accountId: accountId }
      });
      
      if (accountById) {
        return res.json({
          success: true,
          message: 'Found by accountId',
          account: {
            id: accountById.id,
            accountId: accountById.accountId,
            accountName: accountById.accountName,
            customerCode: accountById.customerCode,
            vendorCode: accountById.vendorCode,
            authenticationType: accountById.authenticationType,
            authenticationValue: accountById.authenticationValue,
            gatewayId: accountById.gatewayId,
            accountRole: accountById.accountRole
          },
          sampleCdrs: await CDR.findAll({
            where: vendorReport ? { agentaccount: accountById.gatewayId } : { customeraccount: accountById.gatewayId },
            limit: 5,
            attributes: ['customeraccount', 'agentaccount', 'customername', 'agentname', 'starttime'],
            raw: true
          })
        });
      }
      
      return res.json({
        success: false,
        message: `Account not found for ${vendorReport ? 'vendorCode' : 'customerCode'}: ${accountId}`
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
        authenticationType: account.authenticationType,
        authenticationValue: account.authenticationValue,
        accountRole: account.accountRole
      },
      conditions: conditions,
      sampleCdrs: cdrs,
      message: conditions.length > 0
        ? `Found ${cdrs.length} sample CDRs using ${account.authenticationType} authentication`
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
      attributes: ['id', 'accountId', 'accountName', 'accountRole', 'customerCode', 'vendorCode', 'gatewayId'],
      where: { active: true },
      order: [['accountName', 'ASC']]
    });

    const customers = accounts.filter(a => ['customer', 'both'].includes(a.accountRole));
    const vendors = accounts.filter(a => ['vendor', 'both'].includes(a.accountRole));

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