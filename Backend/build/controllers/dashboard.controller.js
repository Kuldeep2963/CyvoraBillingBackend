'use strict';

const { Op, fn, col, literal } = require('sequelize');
const moment  = require('moment');
const CDR     = require('../models/CDR');
const Account = require('../models/Account');
const CountryCode = require('../models/CountryCode');
const H       = require('../utils/reportHelper');

/* ─── FORMAT TIME ────────────────────────────────────────────────────────────
 *
 * FIX Bug 2: use setUTCHours instead of setHours.
 * setHours uses the server's local timezone. If the server is in IST (UTC+5:30),
 * setHours(0) gives 00:00 IST = 18:30 UTC the day before — wrong.
 * setUTCHours(0) always gives 00:00 UTC regardless of server timezone.
 */
const formatTime = (date, hour, isEnd = false) => {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  d.setUTCHours(hour, isEnd ? 59 : 0, isEnd ? 59 : 0, isEnd ? 999 : 0);
  return d.getTime().toString();
};

/* ─── COUNTRY CODE CACHE ─────────────────────────────────────────────────────*/

let countryCodesCache = null;
let cacheTimestamp    = null;
const CACHE_DURATION  = 1000 * 60 * 60; // 1 hour

const getCountryCodes = async () => {
  if (!countryCodesCache || (Date.now() - cacheTimestamp > CACHE_DURATION)) {
    countryCodesCache = await CountryCode.findAll({ raw: true });
    cacheTimestamp    = Date.now();
  }
  return countryCodesCache;
};

const getCountryFromNumber = (number, countryCodes, skipPrefix = false) => {
  if (!number) return 'Unknown';
  let cleaned = number.toString().replace(/^(\+|00)/, '');
  if (skipPrefix && cleaned.length > 5) cleaned = cleaned.substring(5);
  const sortedCodes = [...countryCodes].sort((a, b) => b.code.length - a.code.length);
  for (const cc of sortedCodes) {
    if (cleaned.startsWith(cc.code)) return cc.country_name;
  }
  return 'Unknown';
};

const getTrunkName = (number) => {
  if (!number) return 'Unknown';
  const trunkPrefix = number.toString().substring(0, 5);
  if (trunkPrefix.startsWith('10')) return 'NCLI';
  if (trunkPrefix.startsWith('20')) return 'CLI';
  if (trunkPrefix.startsWith('30')) return 'ortp/TDM';
  if (trunkPrefix.startsWith('40')) return 'CC';
  return 'Unknown';
};

/* ─── DATE RANGE BUILDER ─────────────────────────────────────────────────────
 *
 * FIX Bug 1 + Bug 3 (both fixed here):
 *
 * Bug 1 — moment().startOf('day') uses local server time.
 *   Fix: use moment.utc().startOf('day') so all boundaries are UTC midnight,
 *   which is what VOS3000 uses when writing starttime.
 *
 * Bug 3 — Op.between on string columns does lexicographic comparison.
 *   "999" > "1000" lexicographically, so any timestamp range query on a
 *   VARCHAR/TEXT starttime column silently returns wrong rows.
 *   Fix: use literal('CAST(starttime AS BIGINT)') with Op.between so
 *   PostgreSQL compares as numbers, not strings.
 *   The values passed are JS numbers (not strings) so the cast is clean.
 *
 * We build a `where` using a literal cast every time so the comparison
 * is always numeric regardless of how starttime is stored in the column.
 */
const buildTimeWhere = (startMs, endMs) => ({
  // Cast starttime to BIGINT for numeric comparison.
  // This is safe because starttime is always a valid integer string.
  [Op.and]: literal(
    `CAST(starttime AS BIGINT) BETWEEN ${startMs} AND ${endMs}`
  ),
});

const getDateRange = (range, startDate, endDate) => {
  if (range) {
    // All boundaries in UTC so they match VOS3000's UTC timestamps
    const endMs   = moment.utc().valueOf();
    let   startMs;

    switch (range) {
      case 'today':
        startMs = moment.utc().startOf('day').valueOf();
        break;
      case 'week':
        startMs = moment.utc().subtract(7, 'days').startOf('day').valueOf();
        break;
      case 'biweekly':
        startMs = moment.utc().subtract(14, 'days').startOf('day').valueOf();
        break;
      case 'monthly':
        startMs = moment.utc().subtract(30, 'days').startOf('day').valueOf();
        break;
      case '3month':
        startMs = moment.utc().subtract(90, 'days').startOf('day').valueOf();
        break;
      default:
        startMs = moment.utc().startOf('day').valueOf();
    }

    return buildTimeWhere(startMs, endMs);
  }

  if (startDate && endDate) {
    const startMs = Number(formatTime(startDate, 0));
    const endMs   = Number(formatTime(endDate, 23, true));
    if (startMs && endMs) return buildTimeWhere(startMs, endMs);
  }

  // Default: today in UTC
  const startMs = moment.utc().startOf('day').valueOf();
  const endMs   = moment.utc().valueOf();
  return buildTimeWhere(startMs, endMs);
};

/* ─── CONTROLLERS ────────────────────────────────────────────────────────────*/

exports.getTopDestinations = async (req, res) => {
  try {
    const { startDate, endDate, range, sortBy = 'cost', limit = 10 } = req.query;

    const where = getDateRange(range, startDate, endDate);

    const destinationDataRaw = await CDR.findAll({
      attributes: [
        'calleee164',
        [fn('COUNT', col('id')),    'totalCalls'],
        [fn('SUM', H.completedCall), 'completedCalls'],
        [fn('SUM', H.durationSec),  'duration'],
        [fn('SUM', H.revenue),      'revenue'],
        [fn('SUM', H.cost),         'cost'],
      ],
      where,
      group: ['calleee164'],
      raw: true,
    });

    const countryCodes = await getCountryCodes();

    const groupedDestinations = {};
    destinationDataRaw.forEach(item => {
      const destination = getCountryFromNumber(item.calleee164, countryCodes, true);
      const trunk       = getTrunkName(item.calleee164);
      const key         = `${destination}-${trunk}`;

      if (!groupedDestinations[key]) {
        groupedDestinations[key] = {
          destination,
          trunk,
          totalCalls:     0,
          completedCalls: 0,
          duration:       0,
          revenue:        0,
          cost:           0,
        };
      }
      groupedDestinations[key].totalCalls     += Number(item.totalCalls);
      groupedDestinations[key].completedCalls += Number(item.completedCalls);
      groupedDestinations[key].duration       += Number(item.duration);
      groupedDestinations[key].revenue        += Number(item.revenue);
      groupedDestinations[key].cost           += Number(item.cost);
    });

    const topDestinations = Object.values(groupedDestinations)
      .map(item => {
        const minutes = item.duration / 60;
        return {
          destination:      item.destination,
          trunk:            item.trunk,
          totalCalls:       item.totalCalls,
          completedCalls:   item.completedCalls,
          minutes:          parseFloat(minutes.toFixed(2)),
          revenue:          parseFloat(item.revenue.toFixed(4)),
          cost:             parseFloat(item.cost.toFixed(4)),
          margin:           parseFloat((item.revenue - item.cost).toFixed(4)),
          marginPercentage: item.revenue > 0
            ? parseFloat((((item.revenue - item.cost) / item.revenue) * 100).toFixed(5))
            : 0,
          ASR: item.totalCalls > 0
            ? parseFloat(((item.completedCalls / item.totalCalls) * 100).toFixed(4))
            : 0,
          ACD: item.completedCalls > 0
            ? parseFloat((item.duration / item.completedCalls / 60).toFixed(4))
            : 0,
        };
      })
      .sort((a, b) => {
        if (sortBy === 'completedCalls') return b.completedCalls - a.completedCalls;
        if (sortBy === 'minutes')        return b.minutes - a.minutes;
        return b.cost - a.cost;
      })
      .slice(0, parseInt(limit));

    res.json({ success: true, data: topDestinations });
  } catch (error) {
    console.error('Top Destinations Error:', error);
    res.status(500).json({
      success:  false,
      message:  'Failed to fetch top destinations',
      error:    error.message,
    });
  }
};

exports.getDashboardStats = async (req, res) => {
  try {
    const { startDate, endDate, range } = req.query;

    const where = getDateRange(range, startDate, endDate);

    // 1. Summary stats
    const stats = await CDR.findOne({
      attributes: [
        [fn('COUNT', col('id')),                          'totalCalls'],
        [fn('SUM', H.completedCall),                      'completedCalls'],
        [fn('SUM', H.revenue),                            'totalRevenue'],
        [fn('SUM', H.durationSec),                        'totalDuration'],
        [fn('COUNT', fn('DISTINCT', col('customeraccount'))), 'activeCustomers'],
      ],
      where,
      raw: true,
    });

    // 2. Hourly call distribution
    const hourlyDistribution = await CDR.findAll({
      attributes: [
        [H.hour,                      'hour'],
        [fn('COUNT', col('id')),       'callsCount'],
        [fn('SUM', H.durationSec),    'totalDurationSec'],
        [fn('SUM', H.cost),           'totalCost'],
      ],
      where,
      group:  [H.hour],
      order:  [[H.hour, 'ASC']],
      raw:    true,
    });

    // 3. Top customers
    const customerDistributionRaw = await CDR.findAll({
      attributes: [
        'customername',
        'customeraccount',
        [fn('COUNT', col('id')), 'totalCalls'],
      ],
      where,
      group:  ['customername', 'customeraccount'],
      order:  [[fn('COUNT', col('id')), 'DESC']],
      limit:  10,
      raw:    true,
    });

    const topCustomers = customerDistributionRaw.map(c => ({
      customerName: c.customername || c.customeraccount,
      totalCalls:   Number(c.totalCalls),
    }));

    // 4. Financial summary
    const financialSummary = await CDR.findOne({
      attributes: [
        [fn('SUM', H.revenue),    'totalRevenue'],
        [fn('SUM', H.cost),       'totalCost'],
        [fn('SUM', H.failedCall), 'failedCalls'],
      ],
      where,
      raw: true,
    });

    const totalRevenue = Number(financialSummary.totalRevenue || 0);
    const totalCost    = Number(financialSummary.totalCost    || 0);
    const failedCalls  = Number(financialSummary.failedCalls  || 0);
    const totalMargin  = totalRevenue - totalCost;

    res.json({
      success: true,
      data: {
        stats: {
          totalCalls:      Number(stats.totalCalls      || 0),
          completedCalls:  Number(stats.completedCalls  || 0),
          totalRevenue:    parseFloat(Number(stats.totalRevenue  || 0).toFixed(4)),
          totalDuration:   parseFloat((Number(stats.totalDuration || 0) / 60).toFixed(2)),
          activeCustomers: Number(stats.activeCustomers || 0),
        },
        hourlyDistribution: hourlyDistribution.map(h => ({
          hour:      parseInt(h.hour),
          callsCount: Number(h.callsCount || 0),
          minutes:   parseFloat((Number(h.totalDurationSec || 0) / 60).toFixed(2)),
          cost:      parseFloat(Number(h.totalCost || 0).toFixed(4)),
        })),
        customerDistribution: topCustomers,
        financialSummary: {
          totalRevenue: parseFloat(totalRevenue.toFixed(4)),
          totalMargin:  parseFloat(totalMargin.toFixed(4)),
          failedCalls:  Math.round(failedCalls),
          totalCost:    parseFloat(totalCost.toFixed(4)),
        },
      },
    });
  } catch (error) {
    console.error('Dashboard Stats Error:', error);
    res.status(500).json({
      success:  false,
      message:  'Failed to fetch dashboard stats',
      error:    error.message,
    });
  }
};