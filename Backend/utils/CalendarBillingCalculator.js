/**
 * CalendarBillingCalculator.js
 * =============================
 * Industry-grade calendar-aware billing cycle calculator.
 * 
 * Implements billing cycles that respect calendar boundaries:
 * - Monthly: 1st → last day of each calendar month (28/29/30/31 days)
 * - Weekly: Monday → Sunday (ISO week)
 * - Biweekly: 1-15 and 16-EOM (creates 2 invoices per month)
 * - Quarterly: Q1/Q2/Q3/Q4 calendar quarters
 * - Annual: Jan 1 → Dec 31
 * - Daily: Each calendar day
 * 
 * All methods are pure functions operating on 'YYYY-MM-DD' date strings
 * to maintain consistency across timezone boundaries.
 */

const moment = require('moment');

const DATE_FORMAT = 'YYYY-MM-DD';

/**
 * Parse a date value to a moment object in DATE_FORMAT
 * @param {*} dateValue - Date string, number, or Date object
 * @returns {moment.Moment|null}
 */
const parseMomentDate = (dateValue) => {
  if (!dateValue) return null;
  
  const numericValue = Number(dateValue);
  let date;
  
  if (!Number.isNaN(numericValue)) {
    const isMilliseconds = Math.abs(numericValue) >= 1e12;
    date = isMilliseconds ? moment.utc(numericValue) : moment.utc(moment.unix(numericValue));
  } else {
    date = moment.utc(String(dateValue).slice(0, 10), DATE_FORMAT, true);
  }
  
  if (!date.isValid()) {
    date = moment.utc(dateValue);
  }
  
  return date.isValid() ? date : null;
};

/**
 * Normalize any date value to 'YYYY-MM-DD' format
 * @param {*} dateValue
 * @returns {string|null}
 */
const normalizeDateOnly = (dateValue) => {
  const date = parseMomentDate(dateValue);
  return date ? date.format(DATE_FORMAT) : null;
};

/**
 * Add a day offset to a normalized date string.
 * @param {*} dateValue
 * @param {number} days
 * @returns {string|null}
 */
const addDays = (dateValue, days) => {
  const date = parseMomentDate(dateValue);
  if (!date) return null;

  const offset = Number(days);
  if (!Number.isFinite(offset)) return null;

  return date.clone().add(offset, 'days').format(DATE_FORMAT);
};

/**
 * Get the last day of a given month as a moment
 * @param {number} year
 * @param {number} month - 1-based (1=Jan, 12=Dec)
 * @returns {moment.Moment}
 */
const getLastDayOfMonth = (year, month) => {
  return moment(`${year}-${String(month).padStart(2, '0')}-01`, DATE_FORMAT)
    .endOf('month');
};

/**
 * Get the first day of a given month as a moment
 * @param {number} year
 * @param {number} month - 1-based (1=Jan, 12=Dec)
 * @returns {moment.Moment}
 */
const getFirstDayOfMonth = (year, month) => {
  return moment(`${year}-${String(month).padStart(2, '0')}-01`, DATE_FORMAT);
};

/**
 * Get ISO week start (Monday) for a given date
 * @param {moment.Moment} date
 * @returns {moment.Moment} - Monday of that week
 */
const getWeekMonday = (date) => {
  const d = moment(date);
  return d.clone().startOf('isoWeek');
};

/**
 * Get ISO week end (Sunday) for a given date
 * @param {moment.Moment} date
 * @returns {moment.Moment} - Sunday of that week
 */
const getWeekSunday = (date) => {
  const d = moment(date);
  return d.clone().endOf('isoWeek');
};

/**
 * Get quarter info for a date
 * @param {moment.Moment} date
 * @returns {number} - Quarter number (1-4)
 */
const getQuarter = (date) => {
  return date.quarter();
};

/**
 * Get the end of a quarter
 * @param {number} year
 * @param {number} quarter - 1-4
 * @returns {moment.Moment}
 */
const getQuarterEnd = (year, quarter) => {
  const monthNum = String(quarter * 3).padStart(2, '0');
  return moment(`${year}-${monthNum}-01`, DATE_FORMAT)
    .endOf('month');
};

/**
 * Get the start of a quarter
 * @param {number} year
 * @param {number} quarter - 1-4
 * @returns {moment.Moment}
 */
const getQuarterStart = (year, quarter) => {
  const month = (quarter - 1) * 3 + 1;
  return moment(`${year}-${String(month).padStart(2, '0')}-01`, DATE_FORMAT);
};

/**
 * Determine which biweekly period (1 or 2) a date falls into
 * Period 1: days 1-15
 * Period 2: days 16-EOM
 * @param {moment.Moment} date
 * @returns {1|2}
 */
const getBiweeklyPeriod = (date) => {
  return date.date() <= 15 ? 1 : 2;
};

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API: Calculate NEXT billing date
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate the NEXT billing date boundary after a given lastBillingDate
 * This is used to set account.nextBillingDate
 * 
 * @param {string} lastBillingDateStr - 'YYYY-MM-DD' of the last invoice period end
 * @param {'daily'|'weekly'|'biweekly'|'monthly'|'quarterly'|'annually'} billingCycle
 * @returns {string|null} - 'YYYY-MM-DD' or null if invalid input
 */
const calculateNextBillingDate = (lastBillingDateStr, billingCycle = 'monthly') => {
  // Under new semantics lastBillingDateStr represents the inclusive START of
  // the last invoiced period. Compute that period's end, then return the
  // trigger date (day after the period end).
  const startDate = parseMomentDate(lastBillingDateStr);
  if (!startDate) return null;

  switch (billingCycle) {
    case 'daily':
      // period end == startDate, trigger == startDate + 1 day
      return startDate.clone().add(1, 'day').format(DATE_FORMAT);

    case 'weekly':
      return startDate.clone().endOf('isoWeek').add(1, 'day').format(DATE_FORMAT);

    case 'biweekly': {
      const day = startDate.date();
      if (day === 1) return startDate.clone().date(15).add(1, 'day').format(DATE_FORMAT);
      if (day === 16) return startDate.clone().endOf('month').add(1, 'day').format(DATE_FORMAT);
      if (day <= 15) return startDate.clone().date(15).add(1, 'day').format(DATE_FORMAT);
      return startDate.clone().endOf('month').add(1, 'day').format(DATE_FORMAT);
    }

    case 'monthly':
      return startDate.clone().endOf('month').add(1, 'day').format(DATE_FORMAT);

    case 'quarterly': {
      const quarter = getQuarter(startDate);
      const year = startDate.year();
      const qEnd = getQuarterEnd(year, quarter);
      return qEnd.add(1, 'day').format(DATE_FORMAT);
    }

    case 'annually':
      return startDate.clone().month(11).date(31).add(1, 'day').format(DATE_FORMAT);

    default:
      return null;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API: Calculate PREVIOUS billing date (for invoice deletion)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate the PREVIOUS billing date boundary (for deletion rollback)
 * This is used when an invoice is deleted to rewind the lastBillingDate
 * 
 * @param {string} currentLastBillingDateStr - 'YYYY-MM-DD' to roll back FROM
 * @param {'daily'|'weekly'|'biweekly'|'monthly'|'quarterly'|'annually'} billingCycle
 * @returns {string|null}
 */
const calculatePrevBillingDate = (currentLastBillingDateStr, billingCycle = 'monthly') => {
  // Under the new semantics, callers provide a period END date (invoice.billingPeriodEnd)
  // and we must return the previous period's START (the inclusive lastBillingDate value).
  const periodEnd = parseMomentDate(currentLastBillingDateStr);
  if (!periodEnd) return null;

  // Helper to compute the start of a period given its end
  const getPeriodStartFromPeriodEnd = (endMoment, cycle) => {
    const d = endMoment.clone();
    switch (cycle) {
      case 'daily':
        return d.clone().format(DATE_FORMAT);
      case 'weekly':
        return d.clone().startOf('isoWeek').format(DATE_FORMAT);
      case 'biweekly': {
        const day = d.date();
        const eom = d.clone().endOf('month').date();
        // If period end is 15th -> start is 1st
        if (day === 15) return d.clone().startOf('month').format(DATE_FORMAT);
        // If period end is EOM -> start is 16th
        if (day === eom) return d.clone().date(16).format(DATE_FORMAT);
        // Fallback: if day <= 15 treat as period 1 start, else period 2 start
        return (day <= 15) ? d.clone().startOf('month').format(DATE_FORMAT) : d.clone().date(16).format(DATE_FORMAT);
      }
      case 'monthly':
        return d.clone().startOf('month').format(DATE_FORMAT);
      case 'quarterly': {
        const quarter = getQuarter(d);
        const year = d.year();
        return getQuarterStart(year, quarter).format(DATE_FORMAT);
      }
      case 'annually':
        return d.clone().month(0).date(1).format(DATE_FORMAT);
      default:
        return d.clone().startOf('month').format(DATE_FORMAT);
    }
  };

  // Find the START of the current period, then step back one day to get the
  // previous period's end, then compute the previous period's start.
  const thisPeriodStartStr = getPeriodStartFromPeriodEnd(periodEnd, billingCycle);
  const thisPeriodStart = parseMomentDate(thisPeriodStartStr);
  if (!thisPeriodStart) return null;

  const prevPeriodEnd = thisPeriodStart.clone().subtract(1, 'day');
  const prevPeriodStartStr = getPeriodStartFromPeriodEnd(prevPeriodEnd, billingCycle);
  return prevPeriodStartStr || null;
};

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API: Initialize lastBillingDate for new accounts
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate the INITIAL lastBillingDate for a newly created account
 * This is the END date of the period BEFORE the account was created
 * 
 * @param {'daily'|'weekly'|'biweekly'|'monthly'|'quarterly'|'annually'} billingCycle
 * @param {*} referenceDate - Account creation or billing start date (defaults to today)
 * @returns {string} - 'YYYY-MM-DD'
 */
const getInitialLastBillingDate = (billingCycle = 'monthly', referenceDate = null) => {
  const ref = parseMomentDate(referenceDate) || moment();

  switch (billingCycle) {
    case 'daily':
      // For daily, lastBillingDate is yesterday
      return ref.clone().subtract(1, 'day').format(DATE_FORMAT);

    case 'weekly':
      // For weekly, lastBillingDate is the Monday starting the CURRENT week
      return ref.clone().startOf('isoWeek').format(DATE_FORMAT);

    case 'biweekly':
      // For biweekly, lastBillingDate is the START of the CURRENT period
      // If today is in period 1 (day 1-15) → lastBillingDate = 1st of this month
      // If today is in period 2 (day 16+) → lastBillingDate = 16th of this month
      {
        const day = ref.date();
        if (day <= 15) {
          return ref.clone().startOf('month').format(DATE_FORMAT);
        }
        return ref.clone().date(16).format(DATE_FORMAT);
      }

    case 'monthly':
      // For monthly, lastBillingDate is the 1st day of the CURRENT month
      return ref.clone().startOf('month').format(DATE_FORMAT);

    case 'quarterly':
      {
        const quarter = getQuarter(ref);
        const year = ref.year();
        // lastBillingDate is EOM of the PREVIOUS quarter
        const prevQuarter = quarter === 1 ? 4 : quarter - 1;
        const prevYear = quarter === 1 ? year - 1 : year;
        return getQuarterEnd(prevYear, prevQuarter).format(DATE_FORMAT);
      }

    case 'annually':
      // For annual, lastBillingDate is Dec 31 of the PREVIOUS year
      return ref.clone().subtract(1, 'year').month(11).date(31).format(DATE_FORMAT);

    default:
      return ref.clone().subtract(1, 'month').endOf('month').format(DATE_FORMAT);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API: Get billing period window (start and end dates)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get the current billing period window [start, end] for a given lastBillingDate
 * The period start is the day AFTER lastBillingDate
 * The period end is the nextBillingDate
 * 
 * @param {string} lastBillingDateStr - 'YYYY-MM-DD' of the last period end
 * @param {'daily'|'weekly'|'biweekly'|'monthly'|'quarterly'|'annually'} billingCycle
 * @returns {Object} { billingPeriodStart, billingPeriodEnd, nextBillingDate }
 */
const getBillingPeriodWindow = (lastBillingDateStr, billingCycle = 'monthly') => {
  if (!lastBillingDateStr || !billingCycle) {
    return { billingPeriodStart: null, billingPeriodEnd: null, nextBillingDate: null };
  }

  const last = parseMomentDate(lastBillingDateStr);
  if (!last) {
    return { billingPeriodStart: null, billingPeriodEnd: null, nextBillingDate: null };
  }

  const nextBillingDate = calculateNextBillingDate(lastBillingDateStr, billingCycle);
  if (!nextBillingDate) {
    return { billingPeriodStart: null, billingPeriodEnd: null, nextBillingDate: null };
  }

  // Period start is the inclusive lastBillingDate (start of the period)
  const periodStart = last.clone().format(DATE_FORMAT);

  // Period end is the day BEFORE the nextBillingDate trigger
  const periodEnd = addDays(nextBillingDate, -1);

  return {
    billingPeriodStart: periodStart,
    billingPeriodEnd: periodEnd,
    nextBillingDate,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API: Build billing updates for account after invoice creation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * After an invoice is created for a period, calculate the new billing cursors
 * The lastBillingDate becomes the period end of the newly created invoice
 * The nextBillingDate is calculated from the new lastBillingDate
 * 
 * @param {Object} account - Account object with billingCycle
 * @param {'customer'|'vendor'} invoiceType
 * @param {string} invoicePeriodEndStr - 'YYYY-MM-DD' of the newly created invoice's period end
 * @returns {Object} - Update object with lastBillingDate and nextBillingDate fields
 */
const buildBillingUpdates = (account, invoiceType = 'customer', invoicePeriodEndStr) => {
  if (!account || !invoicePeriodEndStr) return {};

  const endDate = normalizeDateOnly(invoicePeriodEndStr);
  if (!endDate) return {};

  const cycle = account.billingCycle || 'monthly';
  // Advance to the next unbilled period start.
  const lastBillingDate = addDays(endDate, 1);
  const nextBillingDate = calculateNextBillingDate(lastBillingDate, cycle);

  const isVendor = invoiceType === 'vendor';
  const lastField = isVendor ? 'vendorLastBillingDate' : 'customerLastBillingDate';
  const nextField = isVendor ? 'vendorNextBillingDate' : 'customerNextBillingDate';

  return {
    [lastField]: lastBillingDate,
    [nextField]: nextBillingDate,
    // Keep legacy fields in sync for backward compatibility
    lastbillingdate: lastBillingDate,
    nextbillingdate: nextBillingDate,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  // Core date utilities
  addDays,
  normalizeDateOnly,
  parseMomentDate,
  
  // Period boundary calculations
  calculateNextBillingDate,
  calculatePrevBillingDate,
  getInitialLastBillingDate,
  getBillingPeriodWindow,
  buildBillingUpdates,
  
  // Helper utilities (for internal use or testing)
  getLastDayOfMonth,
  getFirstDayOfMonth,
  getWeekMonday,
  getWeekSunday,
  getQuarter,
  getQuarterEnd,
  getQuarterStart,
  getBiweeklyPeriod,
  
  // Constants
  DATE_FORMAT,
};
