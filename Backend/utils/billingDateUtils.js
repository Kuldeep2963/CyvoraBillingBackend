const moment = require('moment');

const DATE_FORMAT = 'YYYY-MM-DD';

const normalizeDateOnly = (value) => {
  if (!value && value !== 0) return null;

  const numericValue = Number(value);
  const parsed = !Number.isNaN(numericValue)
    ? moment(numericValue)
    : moment(String(value).slice(0, 10), DATE_FORMAT, true);

  if (!parsed.isValid()) {
    const fallback = moment(value);
    return fallback.isValid() ? fallback.format(DATE_FORMAT) : null;
  }

  return parsed.format(DATE_FORMAT);
};

const addDays = (dateValue, days) => {
  const date = normalizeDateOnly(dateValue);
  if (!date) return null;
  return moment(date, DATE_FORMAT).add(days, 'days').format(DATE_FORMAT);
};

const endOfMonth = (dateValue) => {
  const date = normalizeDateOnly(dateValue);
  if (!date) return null;
  return moment(date, DATE_FORMAT).endOf('month').format(DATE_FORMAT);
};

const endOfPreviousMonth = (referenceDate = new Date()) => {
  return moment(normalizeDateOnly(referenceDate), DATE_FORMAT)
    .subtract(1, 'month')
    .endOf('month')
    .format(DATE_FORMAT);
};

const startOfWeekMonday = (referenceDate = new Date()) => {
  const ref = moment(normalizeDateOnly(referenceDate), DATE_FORMAT);
  const daysSinceMonday = (ref.isoWeekday() + 6) % 7;
  return ref.subtract(daysSinceMonday, 'days').format(DATE_FORMAT);
};

const endOfQuarter = (dateValue) => {
  const date = moment(normalizeDateOnly(dateValue), DATE_FORMAT);
  if (!date.isValid()) return null;
  return date.endOf('quarter').format(DATE_FORMAT);
};

const endOfPreviousQuarter = (referenceDate = new Date()) => {
  return moment(normalizeDateOnly(referenceDate), DATE_FORMAT)
    .subtract(1, 'quarter')
    .endOf('quarter')
    .format(DATE_FORMAT);
};

const isLastDayOfMonth = (dateValue) => {
  const date = moment(normalizeDateOnly(dateValue), DATE_FORMAT);
  return date.isValid() && date.date() === date.daysInMonth();
};

const calculateNextBillingDate = (lastBillingDate, billingCycle = 'monthly') => {
  const last = normalizeDateOnly(lastBillingDate);
  if (!last) return null;

  const date = moment(last, DATE_FORMAT);

  switch (billingCycle) {
    // lastBillingDate is the inclusive period START
    case 'daily':
      return date.clone().add(1, 'day').format(DATE_FORMAT);

    case 'weekly':
      return date.clone().endOf('isoWeek').add(1, 'day').format(DATE_FORMAT);

    case 'biweekly':
      // start could be 1 or 16
      if (date.date() === 1) return date.clone().date(15).add(1, 'day').format(DATE_FORMAT);
      if (date.date() === 16) return date.clone().endOf('month').add(1, 'day').format(DATE_FORMAT);
      return date.date() <= 15
        ? date.clone().date(15).add(1, 'day').format(DATE_FORMAT)
        : date.clone().endOf('month').add(1, 'day').format(DATE_FORMAT);

    case 'monthly':
      return date.clone().endOf('month').add(1, 'day').format(DATE_FORMAT);

    case 'quarterly':
      return date.clone().endOf('quarter').add(1, 'day').format(DATE_FORMAT);

    case 'annually':
      return date.clone().endOf('year').add(1, 'day').format(DATE_FORMAT);

    default:
      return date.add(1, 'month').endOf('month').format(DATE_FORMAT);
  }
};

const getAutoLastBillingDate = (billingCycle = 'monthly', referenceDate = new Date()) => {
  const ref = normalizeDateOnly(referenceDate) || moment().format(DATE_FORMAT);
  const date = moment(ref, DATE_FORMAT);

  switch (billingCycle) {
    case 'daily':
      return date.subtract(1, 'day').format(DATE_FORMAT);
    case 'weekly':
      return startOfWeekMonday(ref);
    case 'biweekly':
      // start of current biweekly period
      return date.date() <= 15 ? date.startOf('month').format(DATE_FORMAT) : date.date(16).format(DATE_FORMAT);
    case 'monthly':
      return date.startOf('month').format(DATE_FORMAT);
    case 'quarterly':
      return endOfPreviousQuarter(ref);
    case 'annually':
      return date.subtract(1, 'year').endOf('year').format(DATE_FORMAT);
    default:
      return endOfPreviousMonth(ref);
  }
};

const getBillingPeriodWindow = (lastBillingDate, billingCycle = 'monthly') => {
  const last = normalizeDateOnly(lastBillingDate);
  if (!last) return { billingPeriodStart: null, billingPeriodEnd: null, nextBillingDate: null };

  const nextBillingDate = calculateNextBillingDate(last, billingCycle);
  if (!nextBillingDate) return { billingPeriodStart: null, billingPeriodEnd: null, nextBillingDate: null };

  switch (billingCycle) {
    case 'daily':
      return {
        billingPeriodStart: last,
        billingPeriodEnd: addDays(nextBillingDate, -1),
        nextBillingDate,
      };

    case 'weekly':
      return {
        billingPeriodStart: last,
        billingPeriodEnd: addDays(nextBillingDate, -1),
        nextBillingDate,
      };

    case 'biweekly':
    case 'monthly':
    case 'quarterly':
    case 'annually':
    default:
      return {
        billingPeriodStart: last,
        billingPeriodEnd: addDays(nextBillingDate, -1),
        nextBillingDate,
      };
  }
};

const buildBillingUpdates = (account, invoiceType, invoicePeriodEnd) => {
  if (!account || !invoicePeriodEnd) return {};

  const endDate = normalizeDateOnly(invoicePeriodEnd);
  if (!endDate) return {};

  const cycle = account.billingCycle || 'monthly';
  // derive period start from invoice period end
  const endMoment = moment(endDate, DATE_FORMAT);
  let invoicePeriodStart;
  switch (cycle) {
    case 'daily': invoicePeriodStart = endMoment.clone().format(DATE_FORMAT); break;
    case 'weekly': invoicePeriodStart = endMoment.clone().startOf('isoWeek').format(DATE_FORMAT); break;
    case 'biweekly': {
      const day = endMoment.date();
      const eom = endMoment.clone().endOf('month').date();
      if (day === 15) invoicePeriodStart = endMoment.clone().startOf('month').format(DATE_FORMAT);
      else if (day === eom) invoicePeriodStart = endMoment.clone().date(16).format(DATE_FORMAT);
      else invoicePeriodStart = day <= 15 ? endMoment.clone().startOf('month').format(DATE_FORMAT) : endMoment.clone().date(16).format(DATE_FORMAT);
      break;
    }
    case 'monthly': invoicePeriodStart = endMoment.clone().startOf('month').format(DATE_FORMAT); break;
    case 'quarterly': {
      const q = endMoment.quarter();
      invoicePeriodStart = getQuarterStart(endMoment.year(), q).format(DATE_FORMAT);
      break;
    }
    case 'annually': invoicePeriodStart = endMoment.clone().month(0).date(1).format(DATE_FORMAT); break;
    default: invoicePeriodStart = endMoment.clone().startOf('month').format(DATE_FORMAT);
  }
  const lastBillingDate = invoicePeriodStart;
  const nextBillingDate = calculateNextBillingDate(lastBillingDate, cycle);
  const isVendor = invoiceType === 'vendor';
  const lastField = isVendor ? 'vendorLastBillingDate' : 'customerLastBillingDate';
  const nextField = isVendor ? 'vendorNextBillingDate' : 'customerNextBillingDate';

  return {
    [lastField]: lastBillingDate,
    [nextField]: nextBillingDate,
    lastbillingdate: lastBillingDate,
    nextbillingdate: nextBillingDate,
  };
};

module.exports = {
  DATE_FORMAT,
  addDays,
  buildBillingUpdates,
  calculateNextBillingDate,
  endOfMonth,
  endOfPreviousMonth,
  getAutoLastBillingDate,
  getBillingPeriodWindow,
  normalizeDateOnly,
  startOfWeekMonday,
};
