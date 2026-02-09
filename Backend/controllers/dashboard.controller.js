const { Op, fn, col } = require('sequelize');
const moment = require('moment');
const CDR = require('../models/CDR');
const Account = require('../models/Account');
const CountryCode = require('../models/CountryCode');
const H = require('../utils/reportHelper');

/* ===================== HELPER: FORMAT TIME ===================== */
const formatTime = (date, hour, isEnd = false) => {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  d.setHours(hour, isEnd ? 59 : 0, isEnd ? 59 : 0, isEnd ? 999 : 0);
  return d.getTime().toString();
};

/* ===================== COUNTRY CODE CACHE ===================== */
let countryCodesCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

const getCountryCodes = async () => {
  if (!countryCodesCache || (Date.now() - cacheTimestamp > CACHE_DURATION)) {
    countryCodesCache = await CountryCode.findAll({ raw: true });
    cacheTimestamp = Date.now();
  }
  return countryCodesCache;
};

const getCountryFromNumber = (number, countryCodes) => {
  if (!number) return 'Unknown';
  let cleaned = number.toString().replace(/^(\+|00)/, '');
  
  // Try to match longest prefix first
  const sortedCodes = [...countryCodes].sort((a, b) => b.code.length - a.code.length);
  for (const cc of sortedCodes) {
    if (cleaned.startsWith(cc.code)) {
      return cc.country_name;
    }
  }
  return 'Unknown';
};

exports.getDashboardStats = async (req, res) => {
  try {
    const { startDate, endDate, range } = req.query;
    
    let where = {};
    if (range) {
      const now = moment();
      let start;
      switch (range) {
        case 'today':
          start = moment().startOf('day');
          break;
        case 'week':
          start = moment().subtract(7, 'days').startOf('day');
          break;
        case 'biweekly':
          start = moment().subtract(14, 'days').startOf('day');
          break;
        case 'monthly':
          start = moment().subtract(30, 'days').startOf('day');
          break;
        case '3month':
          start = moment().subtract(90, 'days').startOf('day');
          break;
        default:
          start = moment().startOf('day');
      }
      where.starttime = {
        [Op.between]: [start.valueOf().toString(), now.valueOf().toString()]
      };
    } else if (startDate && endDate) {
      const start = formatTime(startDate, 0);
      const end = formatTime(endDate, 23, true);
      
      if (start && end) {
        where.starttime = {
          [Op.between]: [start, end]
        };
      }
    } else {
      // Default to today if no dates provided
      const start = moment().startOf('day');
      const now = moment();
      where.starttime = {
        [Op.between]: [start.valueOf().toString(), now.valueOf().toString()]
      };
    }

    // 1. Dashboard Stats: {total calls, total revenue, active customers, total duration}
    const stats = await CDR.findOne({
      attributes: [
        [fn('COUNT', col('id')), 'totalCalls'],
        [fn('SUM', H.revenue), 'totalRevenue'],
        [fn('SUM', H.durationSec), 'totalDuration'],
        [fn('COUNT', fn('DISTINCT', col('customeraccount'))), 'activeCustomers']
      ],
      where,
      raw: true
    });

    // 2. Hourly Call Distribution: {hours and calls count}
    const hourlyDistribution = await CDR.findAll({
      attributes: [
        [H.hour, 'hour'],
        [fn('COUNT', col('id')), 'callsCount']
      ],
      where,
      group: [H.hour],
      order: [[H.hour, 'ASC']],
      raw: true
    });

    // 3. Top Destinations: {destination, totalcalls, ACD, ASR, margin, revenue, minutes}
    const destinationDataRaw = await CDR.findAll({
      attributes: [
        'calleee164',
        [fn('COUNT', col('id')), 'totalCalls'],
        [fn('SUM', H.completedCall), 'completedCalls'],
        [fn('SUM', H.durationSec), 'duration'],
        [fn('SUM', H.revenue), 'revenue'],
        [fn('SUM', H.cost), 'cost']
      ],
      where,
      group: ['calleee164'],
      raw: true
    });

    const countryCodes = await getCountryCodes();
    
    // Group by destination
    const groupedDestinations = {};
    destinationDataRaw.forEach(item => {
      const destination = getCountryFromNumber(item.calleee164, countryCodes);
      
      if (!groupedDestinations[destination]) {
        groupedDestinations[destination] = {
          destination,
          totalCalls: 0,
          completedCalls: 0,
          duration: 0,
          revenue: 0,
          cost: 0
        };
      }
      groupedDestinations[destination].totalCalls += Number(item.totalCalls);
      groupedDestinations[destination].completedCalls += Number(item.completedCalls);
      groupedDestinations[destination].duration += Number(item.duration);
      groupedDestinations[destination].revenue += Number(item.revenue);
      groupedDestinations[destination].cost += Number(item.cost);
    });

    const topDestinations = Object.values(groupedDestinations)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)
      .map(item => {
        const minutes = item.duration / 60;
        const revenue = item.revenue;
        const cost = item.cost;
        return {
          destination: item.destination,
          totalCalls: item.totalCalls,
          minutes: parseFloat(minutes.toFixed(2)),
          revenue: parseFloat(revenue.toFixed(4)),
          margin: parseFloat((revenue - cost).toFixed(4)),
          marginPercentage: revenue > 0 ? parseFloat((((revenue - cost) / revenue) * 100).toFixed(5)) : 0,
          ASR: item.totalCalls > 0 ? parseFloat(((item.completedCalls / item.totalCalls) * 100).toFixed(4)) : 0,
          ACD: item.completedCalls > 0 ? parseFloat((item.duration / item.completedCalls / 60).toFixed(4)) : 0
        };
      });

    // 4. Top Customers Distribution: {customerName, totalCalls}
    const customerDistributionRaw = await CDR.findAll({
      attributes: [
        'customername',
        'customeraccount',
        [fn('COUNT', col('id')), 'totalCalls']
      ],
      where,
      group: ['customername', 'customeraccount'],
      order: [[fn('COUNT', col('id')), 'DESC']],
      limit: 10,
      raw: true
    });

    const topCustomers = customerDistributionRaw.map(c => ({
      customerName: c.customername || c.customeraccount,
      totalCalls: Number(c.totalCalls)
    }));

    // 5. Financial Summary: total revenue, tax collected, income fee, agent fee
    const financialSummary = await CDR.findOne({
      attributes: [
        [fn('SUM', H.revenue), 'totalRevenue'],
        [fn('SUM', H.tax), 'taxCollected'],
        [fn('SUM', H.incomeFee), 'incomeFee'],
        [fn('SUM', H.agentFee), 'agentFee']
      ],
      where,
      raw: true
    });

    res.json({
      success: true,
      data: {
        stats: {
          totalCalls: Number(stats.totalCalls || 0),
          totalRevenue: parseFloat(Number(stats.totalRevenue || 0).toFixed(4)),
          totalDuration: parseFloat((Number(stats.totalDuration || 0) / 60).toFixed(2)), // in minutes
          activeCustomers: Number(stats.activeCustomers || 0)
        },
        hourlyDistribution: hourlyDistribution.map(h => ({
          hour: parseInt(h.hour),
          callsCount: Number(h.callsCount)
        })),
        topDestinations,
        customerDistribution: topCustomers,
        financialSummary: {
          totalRevenue: parseFloat(Number(financialSummary.totalRevenue || 0).toFixed(4)),
          taxCollected: parseFloat(Number(financialSummary.taxCollected || 0).toFixed(4)),
          incomeFee: parseFloat(Number(financialSummary.incomeFee || 0).toFixed(4)),
          agentFee: parseFloat(Number(financialSummary.agentFee || 0).toFixed(4))
        }
      }
    });

  } catch (error) {
    console.error('Dashboard Stats Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard stats',
      error: error.message
    });
  }
};
