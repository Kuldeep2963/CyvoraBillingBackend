/**
 * billingDateUtils.js
 * ===================
 * Industry-grade billing date computation utilities.
 *
 * Billing cycle semantics (as per business requirements):
 *
 *  monthly   → Billing period = 1st → last day of each calendar month.
 *              lastBillingDate is auto-set to last day of the PREVIOUS calendar month.
 *              nextBillingDate is the last day of the CURRENT calendar month.
 *
 *  biweekly  → Two invoices per month: periods are 1–15 and 16–EOM.
 *              lastBillingDate is auto-set to last day of the PREVIOUS calendar month.
 *              nextBillingDate is either the 15th (if today ≤ 15) or last day of month.
 *
 *  weekly    → Billing period = Monday → Sunday.
 *              lastBillingDate is auto-set to the most recent Sunday.
 *              nextBillingDate is the following Sunday.
 *
 *  daily     → Each calendar day. lastBillingDate = yesterday. nextBillingDate = today.
 *
 *  quarterly → Billing period = calendar quarter (Q1: Jan–Mar, Q2: Apr–Jun, etc.).
 *              lastBillingDate = last day of the PREVIOUS quarter.
 *              nextBillingDate = last day of the CURRENT quarter.
 *
 *  annually  → Billing period = calendar year (Jan 1 – Dec 31).
 *              lastBillingDate = Dec 31 of the PREVIOUS year.
 *              nextBillingDate = Dec 31 of the CURRENT year.
 *
 * All helpers are pure functions (no side effects) and operate in LOCAL date space
 * (YYYY-MM-DD strings) to avoid timezone drift across server/client boundaries.
 */

// ─── ISO date string helpers ──────────────────────────────────────────────────

/**
 * Returns a local "YYYY-MM-DD" string from a Date object without UTC shift.
 * @param {Date} date
 * @returns {string}
 */
export const toLocalDateString = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

/**
 * Parses a "YYYY-MM-DD" string into a local midnight Date object.
 * Returns null for invalid/empty input.
 * @param {string} dateStr
 * @returns {Date|null}
 */
export const parseLocalDate = (dateStr) => {
  if (!dateStr || typeof dateStr !== "string") return null;
  const clean = dateStr.slice(0, 10); // guard against ISO timestamps
  const [y, m, d] = clean.split("-").map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  // Validate the parsed date reflects the input (guards against JS overflow e.g. Feb 31)
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
    return null;
  }
  return date;
};

// ─── Calendar helpers ─────────────────────────────────────────────────────────

/**
 * Returns the last day of a given month as a Date (local).
 * @param {number} year
 * @param {number} month  1-based month (1=Jan … 12=Dec)
 * @returns {Date}
 */
export const lastDayOfMonth = (year, month) =>
  new Date(year, month, 0); // day=0 rolls back to last day of previous month

/**
 * Returns "YYYY-MM-DD" for the last day of the month that contains `date`.
 * @param {Date} date
 * @returns {string}
 */
export const endOfMonthStr = (date) =>
  toLocalDateString(lastDayOfMonth(date.getFullYear(), date.getMonth() + 1));

/**
 * Returns "YYYY-MM-DD" for the last day of the month BEFORE the one containing `date`.
 * @param {Date} date
 * @returns {string}
 */
export const endOfPrevMonthStr = (date) =>
  toLocalDateString(lastDayOfMonth(date.getFullYear(), date.getMonth())); // month is 0-based so no -1 needed

/**
 * Returns "YYYY-MM-DD" for the first day of a given year's quarter.
 * @param {number} year
 * @param {number} quarter  1–4
 * @returns {Date}
 */
export const startOfQuarter = (year, quarter) =>
  new Date(year, (quarter - 1) * 3, 1);

/**
 * Returns "YYYY-MM-DD" for the last day of a given year's quarter.
 * @param {number} year
 * @param {number} quarter  1–4
 * @returns {Date}
 */
export const endOfQuarter = (year, quarter) =>
  lastDayOfMonth(year, quarter * 3);

/**
 * Returns the calendar quarter (1–4) for a given date.
 * @param {Date} date
 * @returns {number}
 */
export const getQuarter = (date) =>
  Math.ceil((date.getMonth() + 1) / 3);

/**
 * Returns "YYYY-MM-DD" of the most recent Monday on or before `date`.
 * @param {Date} date
 * @returns {string}
 */
export const startOfWeekStr = (date) => {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun … 6=Sat
  const diff = day === 0 ? -6 : 1 - day; // how many days back to Monday
  d.setDate(d.getDate() + diff);
  return toLocalDateString(d);
};

/**
 * Returns "YYYY-MM-DD" of the most recent Sunday on or before `date`.
 * (i.e. the end of the previous complete week)
 * @param {Date} date
 * @returns {string}
 */
export const endOfPrevWeekStr = (date) => {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun … 6=Sat
  // If today is Sunday, the previous complete week ended LAST Sunday (7 days ago).
  // Otherwise roll back to the most recent Sunday.
  const daysToLastSunday = day === 0 ? 7 : day;
  d.setDate(d.getDate() - daysToLastSunday);
  return toLocalDateString(d);
};

/**
 * Returns "YYYY-MM-DD" of the Sunday that ends the CURRENT week (Mon–Sun).
 * @param {Date} date
 * @returns {string}
 */
export const endOfCurrentWeekStr = (date) => {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun … 6=Sat
  const daysUntilSunday = day === 0 ? 0 : 7 - day;
  d.setDate(d.getDate() + daysUntilSunday);
  return toLocalDateString(d);
};

// ─── Biweekly helpers ─────────────────────────────────────────────────────────

/**
 * Returns which biweekly period (1 or 2) a given date falls in.
 *   Period 1: day 1–15
 *   Period 2: day 16–EOM
 * @param {Date} date
 * @returns {1|2}
 */
export const getBiweeklyPeriod = (date) =>
  date.getDate() <= 15 ? 1 : 2;

/**
 * Returns "YYYY-MM-DD" of the end of the CURRENT biweekly period for `date`.
 *   Period 1 ends on the 15th.
 *   Period 2 ends on EOM.
 * @param {Date} date
 * @returns {string}
 */
export const endOfCurrentBiweeklyStr = (date) => {
  const period = getBiweeklyPeriod(date);
  if (period === 1) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-15`;
  }
  return endOfMonthStr(date);
};

/**
 * Returns "YYYY-MM-DD" of the end of the NEXT biweekly period after `date`.
 * Used to compute nextBillingDate from a lastBillingDate.
 * @param {Date} lastBillingDate  The date the last invoice period ended.
 * @returns {string}
 */
export const nextBiweeklyEndStr = (lastBillingDate) => {
  const day = lastBillingDate.getDate();
  const year = lastBillingDate.getFullYear();
  const month = lastBillingDate.getMonth(); // 0-based

  // If lastBillingDate is the 15th → next period ends on EOM of same month
  if (day === 15) {
    // return trigger = day after EOM
    const eom = endOfMonthStr(lastBillingDate);
    const d = parseLocalDate(eom);
    d.setDate(d.getDate() + 1);
    return toLocalDateString(d);
  }

  // If lastBillingDate is EOM → next period ends on 15th of next month
  const eom = lastDayOfMonth(year, month + 1).getDate();
  if (day === eom) {
    // Move to next month's 15th → trigger is 16th of next month
    const nextMonth = new Date(year, month + 1, 15);
    nextMonth.setDate(nextMonth.getDate() + 1);
    return toLocalDateString(nextMonth);
  }

  // Fallback: treat as end of current biweekly period of the FOLLOWING period
  // This handles mid-period lastBillingDate values (shouldn't occur in normal flow).
  const nextPeriodStart = new Date(year, month, day + 1);
  // return trigger (day after the computed biweekly period end)
  const pe = endOfCurrentBiweeklyStr(nextPeriodStart);
  const pd = parseLocalDate(pe);
  pd.setDate(pd.getDate() + 1);
  return toLocalDateString(pd);
};

// Helper: shift a YYYY-MM-DD string by a number of days
const shiftDateStr = (dateStr, days) => {
  const d = parseLocalDate(dateStr);
  if (!d) return "";
  d.setDate(d.getDate() + Number(days));
  return toLocalDateString(d);
};

// ─── Core: Auto-set last billing date by cycle ───────────────────────────────

/**
 * Given a billing cycle, returns the "YYYY-MM-DD" that should be used as the
 * default / auto-set lastBillingDate when creating a new account.
 *
 * @param {"daily"|"weekly"|"biweekly"|"monthly"|"quarterly"|"annually"} billingCycle
 * @param {Date} [referenceDate]  Defaults to today (local).
 * @returns {string}  "YYYY-MM-DD"
 */
export const getAutoLastBillingDate = (billingCycle, referenceDate) => {
  const today = referenceDate ?? new Date();

  switch (billingCycle) {
    case "daily":
      // Yesterday
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return toLocalDateString(yesterday);

    case "weekly":
      // Start (inclusive) of the CURRENT Mon–Sun week (Monday)
      return startOfWeekStr(today);

    case "biweekly":
      // Start of the current biweekly period: 1st (if day<=15) or 16th (if day>=16)
      if (today.getDate() <= 15) return toLocalDateString(new Date(today.getFullYear(), today.getMonth(), 1));
      return toLocalDateString(new Date(today.getFullYear(), today.getMonth(), 16));

    case "monthly":
      // Start (1st) of the current month
      return toLocalDateString(new Date(today.getFullYear(), today.getMonth(), 1));

    case "quarterly": {
      const q = getQuarter(today);
      const prevQ = q === 1 ? 4 : q - 1;
      const prevQYear = q === 1 ? today.getFullYear() - 1 : today.getFullYear();
      return toLocalDateString(endOfQuarter(prevQYear, prevQ));
    }

    case "annually":
      // Dec 31 of the previous year
      return `${today.getFullYear() - 1}-12-31`;

    default:
      return endOfPrevMonthStr(today);
  }
};

// ─── Core: Calculate next billing date from last billing date ─────────────────

/**
 * Calculates the nextBillingDate (end of the NEXT invoice period) given a
 * lastBillingDate and billingCycle. Handles partial/edge months correctly.
 *
 * @param {string} lastBillingDateStr  "YYYY-MM-DD" of the last invoice period end.
 * @param {"daily"|"weekly"|"biweekly"|"monthly"|"quarterly"|"annually"} billingCycle
 * @returns {string}  "YYYY-MM-DD" or "" on invalid input.
 */
export const calculateNextBillingDate = (lastBillingDateStr, billingCycle) => {
  if (!lastBillingDateStr || !billingCycle) return "";

  const lastDate = parseLocalDate(lastBillingDateStr);
  if (!lastDate) return "";

  switch (billingCycle) {
    case "daily": {
      // lastDate is period START for daily -> period end == start, trigger == start + 1
      const next = new Date(lastDate);
      next.setDate(next.getDate() + 1);
      return toLocalDateString(next);
    }

    case "weekly": {
      // lastDate is Monday (start) -> end is Sunday -> trigger = next Monday
      const next = new Date(lastDate);
      // move to end of week
      const day = next.getDay();
      const daysUntilSunday = day === 0 ? 0 : 7 - day;
      next.setDate(next.getDate() + daysUntilSunday + 1);
      return toLocalDateString(next);
    }

    case "biweekly": {
      return nextBiweeklyEndStr(lastDate);
    }

    case "monthly": {
      // lastDate is 1st of a month -> period end = EOM of that month; trigger = day after EOM
      const periodEnd = new Date(lastDate.getFullYear(), lastDate.getMonth() + 1, 0);
      periodEnd.setDate(periodEnd.getDate() + 1);
      return toLocalDateString(periodEnd);
    }

    case "quarterly": {
      const q = getQuarter(lastDate);
      const year = lastDate.getFullYear();
      const nextQ = q === 4 ? 1 : q + 1;
      const nextQYear = q === 4 ? year + 1 : year;
      const qe = endOfQuarter(nextQYear, nextQ);
      qe.setDate(qe.getDate() + 1);
      return toLocalDateString(qe);
    }

    case "annually": {
      // lastDate is Jan 1 of a year -> period end = Dec 31 of that year -> trigger = Jan 1 of following year
      return `${lastDate.getFullYear() + 1}-01-01`;
    }

    default:
      return "";
  }
};

// ─── Core: Calculate PREVIOUS billing date (for invoice deletion rollback) ───

/**
 * When an invoice is deleted, roll back the lastBillingDate to the end of the
 * period BEFORE the deleted invoice's period start.
 *
 * @param {string} currentLastBillingDateStr  "YYYY-MM-DD" — the date we want to roll back FROM.
 * @param {"daily"|"weekly"|"biweekly"|"monthly"|"quarterly"|"annually"} billingCycle
 * @returns {string}  "YYYY-MM-DD" or "" on invalid input.
 */
export const calculatePrevBillingDate = (currentLastBillingDateStr, billingCycle) => {
  if (!currentLastBillingDateStr || !billingCycle) return "";

  const date = parseLocalDate(currentLastBillingDateStr);
  if (!date) return "";
  // Treat input as a period END date, return the PREVIOUS period's START
  const getPeriodStartFromPeriodEnd = (endDate, cycle) => {
    const d = new Date(endDate);
    switch (cycle) {
      case 'daily':
        return toLocalDateString(d);
      case 'weekly':
        // start = Monday of that week
        return startOfWeekStr(d);
      case 'biweekly': {
        const day = d.getDate();
        const eom = lastDayOfMonth(d.getFullYear(), d.getMonth() + 1).getDate();
        if (day === 15) return toLocalDateString(new Date(d.getFullYear(), d.getMonth(), 1));
        if (day === eom) return toLocalDateString(new Date(d.getFullYear(), d.getMonth(), 16));
        if (day <= 15) return toLocalDateString(new Date(d.getFullYear(), d.getMonth(), 1));
        return toLocalDateString(new Date(d.getFullYear(), d.getMonth(), 16));
      }
      case 'monthly':
        return toLocalDateString(new Date(d.getFullYear(), d.getMonth(), 1));
      case 'quarterly': {
        const q = getQuarter(d);
        const year = d.getFullYear();
        const start = startOfQuarter(year, q);
        return toLocalDateString(start);
      }
      case 'annually':
        return `${d.getFullYear()}-01-01`;
      default:
        return toLocalDateString(new Date(d.getFullYear(), d.getMonth(), 1));
    }
  };

  const thisPeriodStart = getPeriodStartFromPeriodEnd(date, billingCycle);
  if (!thisPeriodStart) return "";

  const thisPeriodStartDate = parseLocalDate(thisPeriodStart);
  if (!thisPeriodStartDate) return "";

  // previous period end is the day before this period start
  const prevPeriodEnd = new Date(thisPeriodStartDate);
  prevPeriodEnd.setDate(prevPeriodEnd.getDate() - 1);
  const prevPeriodStart = getPeriodStartFromPeriodEnd(prevPeriodEnd, billingCycle);
  return prevPeriodStart || "";
};

// ─── Core: Derive billing period start from lastBillingDate ──────────────────

/**
 * Returns the start date ("YYYY-MM-DD") of the CURRENT billing period
 * (i.e. the day after the lastBillingDate's period ended).
 *
 * @param {string} lastBillingDateStr  "YYYY-MM-DD"
 * @param {"daily"|"weekly"|"biweekly"|"monthly"|"quarterly"|"annually"} billingCycle
 * @returns {string}
 */
export const currentPeriodStart = (lastBillingDateStr, billingCycle) => {
  if (!lastBillingDateStr || !billingCycle) return "";

  const lastDate = parseLocalDate(lastBillingDateStr);
  if (!lastDate) return "";
  // Under new semantics, lastBillingDateStr is the inclusive period START
  return lastBillingDateStr;
};

export const currentBillingPeriodWindow = (lastBillingDateStr, billingCycle) => {
  const periodStart = currentPeriodStart(lastBillingDateStr, billingCycle);
  const nextBillingDate = calculateNextBillingDate(lastBillingDateStr, billingCycle);
  if (!periodStart || !nextBillingDate) {
    return { periodStart: "", periodEnd: "", nextBillingDate: "" };
  }

  const periodEnd = shiftDateStr(nextBillingDate, -1);
  return {
    periodStart,
    periodEnd,
    nextBillingDate,
  };
};

// ─── Invoice event handlers ───────────────────────────────────────────────────

/**
 * Returns updated lastBillingDate and nextBillingDate after an INVOICE IS CREATED
 * (i.e. a billing period has just been closed / invoiced).
 *
 * The invoice period end date becomes the new lastBillingDate.
 * nextBillingDate is then recalculated from that new last date.
 *
 * @param {string} invoicePeriodEndStr  "YYYY-MM-DD" — the period end date of the new invoice.
 * @param {"daily"|"weekly"|"biweekly"|"monthly"|"quarterly"|"annually"} billingCycle
 * @returns {{ lastBillingDate: string, nextBillingDate: string }}
 */
export const onInvoiceCreated = (invoicePeriodEndStr, billingCycle) => {
  const periodEnd = parseLocalDate(invoicePeriodEndStr);
  if (!periodEnd) return { lastBillingDate: "", nextBillingDate: "" };
  // Compute the invoice's period START (inclusive) from the period END
  const getPeriodStartFromEnd = (endDate, cycle) => {
    const d = new Date(endDate);
    switch (cycle) {
      case 'daily':
        return toLocalDateString(d);
      case 'weekly':
        return startOfWeekStr(d);
      case 'biweekly': {
        const day = d.getDate();
        const eom = lastDayOfMonth(d.getFullYear(), d.getMonth() + 1).getDate();
        if (day === 15) return toLocalDateString(new Date(d.getFullYear(), d.getMonth(), 1));
        if (day === eom) return toLocalDateString(new Date(d.getFullYear(), d.getMonth(), 16));
        return day <= 15 ? toLocalDateString(new Date(d.getFullYear(), d.getMonth(), 1)) : toLocalDateString(new Date(d.getFullYear(), d.getMonth(), 16));
      }
      case 'monthly':
        return toLocalDateString(new Date(d.getFullYear(), d.getMonth(), 1));
      case 'quarterly': {
        const q = getQuarter(d);
        const year = d.getFullYear();
        const start = startOfQuarter(year, q);
        return toLocalDateString(start);
      }
      case 'annually':
        return `${d.getFullYear()}-01-01`;
      default:
        return toLocalDateString(new Date(d.getFullYear(), d.getMonth(), 1));
    }
  };

  const lastBillingDate = getPeriodStartFromEnd(periodEnd, billingCycle);
  const nextBillingDate = calculateNextBillingDate(lastBillingDate, billingCycle);
  return { lastBillingDate, nextBillingDate };
};

/**
 * Returns updated lastBillingDate and nextBillingDate after an INVOICE IS DELETED.
 *
 * Roll back: the new lastBillingDate becomes the end of the period BEFORE
 * the deleted invoice's period. The nextBillingDate is then recomputed from that.
 *
 * @param {string} currentLastBillingDateStr  "YYYY-MM-DD" — the lastBillingDate BEFORE deletion.
 * @param {string} deletedInvoicePeriodEndStr "YYYY-MM-DD" — the period end of the deleted invoice.
 * @param {"daily"|"weekly"|"biweekly"|"monthly"|"quarterly"|"annually"} billingCycle
 * @returns {{ lastBillingDate: string, nextBillingDate: string }}
 */
export const onInvoiceDeleted = (currentLastBillingDateStr, deletedInvoicePeriodEndStr, billingCycle) => {
  // After deletion, roll back to the period before the deleted invoice
  const newLastBillingDate = calculatePrevBillingDate(deletedInvoicePeriodEndStr, billingCycle);
  const newNextBillingDate = calculateNextBillingDate(newLastBillingDate, billingCycle);
  return { lastBillingDate: newLastBillingDate, nextBillingDate: newNextBillingDate };
};

// ─── Bulk recalculation ───────────────────────────────────────────────────────

/**
 * Given an array of invoice period-end dates (ascending), and a billing cycle,
 * reconstructs the lastBillingDate and nextBillingDate as they would be after all
 * invoices are accounted for.
 *
 * Useful for reconciliation / audit.
 *
 * @param {string[]} invoicePeriodEnds  Array of "YYYY-MM-DD" strings (ascending).
 * @param {"daily"|"weekly"|"biweekly"|"monthly"|"quarterly"|"annually"} billingCycle
 * @param {Date} [referenceDate]  Defaults to today.
 * @returns {{ lastBillingDate: string, nextBillingDate: string }}
 */
export const recalculateBillingDates = (invoicePeriodEnds, billingCycle, referenceDate) => {
  if (!billingCycle) return { lastBillingDate: "", nextBillingDate: "" };

  const sorted = [...(invoicePeriodEnds ?? [])]
    .filter(Boolean)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  const lastInvoiceEnd = sorted[sorted.length - 1];
  const lastBillingDate = sorted.length > 0
    ? onInvoiceCreated(lastInvoiceEnd, billingCycle).lastBillingDate
    : getAutoLastBillingDate(billingCycle, referenceDate);

  const nextBillingDate = calculateNextBillingDate(lastBillingDate, billingCycle);
  return { lastBillingDate, nextBillingDate };
};

// ─── Label helpers (UI) ───────────────────────────────────────────────────────

/**
 * Returns a human-readable label for a billing cycle period.
 * @param {string} billingCycle
 * @returns {string}
 */
export const getBillingCycleLabel = (billingCycle) => {
  const labels = {
    daily:     "Daily",
    weekly:    "Weekly (Mon–Sun)",
    biweekly:  "Biweekly (1–15, 16–EOM)",
    monthly:   "Monthly (1st–EOM)",
    quarterly: "Quarterly",
    annually:  "Annually",
  };
  return labels[billingCycle] ?? billingCycle;
};

/**
 * Returns a short human-readable description of what lastBillingDate means for a cycle.
 * Used as helper text in the UI.
 * @param {string} billingCycle
 * @returns {string}
 */
export const getLastBillingDateHelperText = (billingCycle) => {
  const texts = {
    daily:     "Auto-set to yesterday (period start for daily).",
    weekly:    "Auto-set to the current week's Monday (period start for weekly).",
    biweekly:  "Auto-set to 1st or 16th of the month (period start for biweekly).",
    monthly:   "Auto-set to the 1st day of the current month (period start).",
    quarterly: "Auto-set to the start of the current calendar quarter (period start).",
    annually:  "Auto-set to January 1 of the current year (period start).",
  };
  return texts[billingCycle] ?? "";
};

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Returns true if the given "YYYY-MM-DD" string is a valid billing period end
 * date for the specified cycle.
 *
 * Validates:
 *   monthly   → must be the last day of its month
 *   biweekly  → must be 15th or last day of month
 *   weekly    → must be a Monday
 *   quarterly → must be last day of a calendar quarter
 *   annually  → must be Dec 31
 *   daily     → any valid date
 *
 * @param {string} dateStr     "YYYY-MM-DD"
 * @param {string} billingCycle
 * @returns {{ valid: boolean, reason?: string }}
 */
export const validateBillingPeriodEnd = (dateStr, billingCycle) => {
  const date = parseLocalDate(dateStr);
  if (!date) return { valid: false, reason: "Invalid date format." };

  switch (billingCycle) {
    case "monthly": {
      const eom = lastDayOfMonth(date.getFullYear(), date.getMonth() + 1).getDate();
      if (date.getDate() !== eom)
        return { valid: false, reason: `Monthly billing periods must end on the last day of the month (expected ${toLocalDateString(lastDayOfMonth(date.getFullYear(), date.getMonth() + 1))}).` };
      return { valid: true };
    }

    case "biweekly": {
      const day = date.getDate();
      const eom = lastDayOfMonth(date.getFullYear(), date.getMonth() + 1).getDate();
      if (day !== 15 && day !== eom)
        return { valid: false, reason: `Biweekly billing periods must end on the 15th or the last day of the month.` };
      return { valid: true };
    }

    case "weekly": {
      if (date.getDay() !== 0) // 0 = Sunday
        return { valid: false, reason: "Weekly billing periods must end on Sunday." };
      return { valid: true };
    }

    case "quarterly": {
      const q = getQuarter(date);
      const expectedEnd = toLocalDateString(endOfQuarter(date.getFullYear(), q));
      if (toLocalDateString(date) !== expectedEnd)
        return { valid: false, reason: `Quarterly billing periods must end on ${expectedEnd}.` };
      return { valid: true };
    }

    case "annually": {
      if (date.getMonth() !== 11 || date.getDate() !== 31)
        return { valid: false, reason: "Annual billing periods must end on December 31." };
      return { valid: true };
    }

    case "daily":
      return { valid: true };

    default:
      return { valid: true };
  }
};
