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
    date = isMilliseconds ? moment(numericValue) : moment.unix(numericValue);
  } else {
    date = moment(String(dateValue).slice(0, 10), DATE_FORMAT, true);
  }
  
  if (!date.isValid()) {
    date = moment(dateValue);
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
  const lastDate = parseMomentDate(lastBillingDateStr);
  if (!lastDate) return null;

  switch (billingCycle) {
    case 'daily':
      return lastDate.clone().add(1, 'day').format(DATE_FORMAT);

    case 'weekly':
      // Next billing date is the Sunday that ends the NEXT week
      // If lastBillingDate is a Sunday (end of week), add 7 days
      return lastDate.clone().add(1, 'week').endOf('isoWeek').format(DATE_FORMAT);

    case 'biweekly':
      // Biweekly periods are 1-15 and 16-EOM
      {
        const day = lastDate.date();
        const year = lastDate.year();
        const month = lastDate.month() + 1; // moment uses 0-based

        // If lastBillingDate is the 15th → next period ends on EOM of same month
        if (day === 15) {
          return lastDate.clone().endOf('month').format(DATE_FORMAT);
        }

        // If lastBillingDate is EOM → next period ends on 15th of next month
        const eom = lastDate.clone().endOf('month').date();
        if (day === eom) {
          const nextMonth = lastDate.clone().add(1, 'month');
          return nextMonth.date(15).format(DATE_FORMAT);
        }

        // Fallback for manual dates: determine current period
        // If we're in period 1 (days 1-15) → go to day 15
        if (day <= 15) {
          return lastDate.clone().date(15).format(DATE_FORMAT);
        }
        // If we're in period 2 (days 16+) → go to EOM
        return lastDate.clone().endOf('month').format(DATE_FORMAT);
      }

    case 'monthly':
      // Next billing date is the last day of the next calendar month
      return lastDate.clone().add(1, 'month').endOf('month').format(DATE_FORMAT);

    case 'quarterly':
      {
        const quarter = getQuarter(lastDate);
        const year = lastDate.year();
        const nextQuarter = quarter === 4 ? 1 : quarter + 1;
        const nextYear = quarter === 4 ? year + 1 : year;
        return getQuarterEnd(nextYear, nextQuarter).format(DATE_FORMAT);
      }

    case 'annually':
      // Next billing date is Dec 31 of next year
      return lastDate.clone().add(1, 'year').month(11).date(31).format(DATE_FORMAT);

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
  const date = parseMomentDate(currentLastBillingDateStr);
  if (!date) return null;

  switch (billingCycle) {
    case 'daily':
      return date.clone().subtract(1, 'day').format(DATE_FORMAT);

    case 'weekly':
      // Previous billing date is the Sunday ending the previous ISO week
      return date.clone().subtract(1, 'week').endOf('isoWeek').format(DATE_FORMAT);

    case 'biweekly':
      {
        const day = date.date();
        const year = date.year();
        const month = date.month() + 1;

        // If currentLastBillingDate is the 15th → previous period ended on EOM of prev month
        if (day === 15) {
          return date.clone().subtract(1, 'month').endOf('month').format(DATE_FORMAT);
        }

        // If currentLastBillingDate is EOM → previous period ended on 15th of this month
        const eom = date.clone().endOf('month').date();
        if (day === eom) {
          return date.clone().date(15).format(DATE_FORMAT);
        }

        // Fallback for manual dates
        if (day > 15) {
          return date.clone().date(15).format(DATE_FORMAT);
        }
        return date.clone().subtract(1, 'month').endOf('month').format(DATE_FORMAT);
      }

    case 'monthly':
      // Previous billing date is EOM of previous month
      return date.clone().subtract(1, 'month').endOf('month').format(DATE_FORMAT);

    case 'quarterly':
      {
        const quarter = getQuarter(date);
        const year = date.year();
        const prevQuarter = quarter === 1 ? 4 : quarter - 1;
        const prevYear = quarter === 1 ? year - 1 : year;
        return getQuarterEnd(prevYear, prevQuarter).format(DATE_FORMAT);
      }

    case 'annually':
      // Previous billing date is Dec 31 of previous year
      return date.clone().subtract(1, 'year').month(11).date(31).format(DATE_FORMAT);

    default:
      return null;
  }
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
      // For weekly, lastBillingDate is the Sunday ending the PREVIOUS week
      return ref.clone().subtract(1, 'week').endOf('isoWeek').format(DATE_FORMAT);

    case 'biweekly':
      // For biweekly, lastBillingDate is the end of the PREVIOUS period
      // If today is in period 1 (day 1-15) → lastBillingDate = EOM of previous month
      // If today is in period 2 (day 16+) → lastBillingDate = 15th of this month
      {
        const day = ref.date();
        if (day <= 15) {
          return ref.clone().subtract(1, 'month').endOf('month').format(DATE_FORMAT);
        }
        return ref.clone().date(15).format(DATE_FORMAT);
      }

    case 'monthly':
      // For monthly, lastBillingDate is EOM of the PREVIOUS month
      return ref.clone().subtract(1, 'month').endOf('month').format(DATE_FORMAT);

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

  // Period start is always the day after lastBillingDate
  const periodStart = last.clone().add(1, 'day').format(DATE_FORMAT);

  // Period end is the nextBillingDate
  const periodEnd = nextBillingDate;

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
  const lastBillingDate = endDate; // Invoice period end becomes lastBillingDate
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
