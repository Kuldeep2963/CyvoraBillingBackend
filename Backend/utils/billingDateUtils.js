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
    case 'daily':
      return date.add(1, 'day').format(DATE_FORMAT);

    case 'weekly':
      return date.add(7, 'days').format(DATE_FORMAT);

    case 'biweekly':
      if (date.date() === 15) {
        return date.endOf('month').format(DATE_FORMAT);
      }
      if (isLastDayOfMonth(last)) {
        return date.add(1, 'month').date(15).format(DATE_FORMAT);
      }
      return date.date() < 15
        ? date.date(15).format(DATE_FORMAT)
        : date.endOf('month').format(DATE_FORMAT);

    case 'monthly':
      return date.add(1, 'month').endOf('month').format(DATE_FORMAT);

    case 'quarterly':
      return date.add(1, 'quarter').endOf('quarter').format(DATE_FORMAT);

    case 'annually':
      return date.add(1, 'year').endOf('year').format(DATE_FORMAT);

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
    case 'monthly':
      return endOfPreviousMonth(ref);
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
        billingPeriodStart: nextBillingDate,
        billingPeriodEnd: nextBillingDate,
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
        billingPeriodStart: addDays(last, 1),
        billingPeriodEnd: nextBillingDate,
        nextBillingDate,
      };
  }
};

const buildBillingUpdates = (account, invoiceType, invoicePeriodEnd) => {
  if (!account || !invoicePeriodEnd) return {};

  const endDate = normalizeDateOnly(invoicePeriodEnd);
  if (!endDate) return {};

  const cycle = account.billingCycle || 'monthly';
  const lastBillingDate = cycle === 'weekly' ? addDays(endDate, 1) : endDate;
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
