const { literal } = require('sequelize');

/* ============================================================
   reportHelper.js — SQL literals and JS helpers for CDR reports
   ============================================================
   CDR table key facts (confirmed from live data):
   
   starttime  → Unix milliseconds stored as bigint/text
   feetime    → Billed call duration in SECONDS (integer):
                  0  = unanswered / failed call
                 >0  = answered call, value is duration in seconds
   
   calleee164 → Destination number with VoIP routing PREFIX that
                must be stripped before country-code lookup:
                  "4004#NNNN"  → strip 5 chars  (4-digit trunk + #)
                  "2004#NNNN"  → strip 5 chars
                  "2006NNNN"   → strip 4 chars  (4-digit trunk, no #)
                  "1004#NNNN"  → strip 5 chars
                  "2011#NNNN"  → strip 5 chars
                  "apexccNNNN" → strip 6 chars  (text prefix)
                  "arptelNNNN" → strip 6 chars  (text prefix)
                  plain number → strip 0 chars
   
   Timestamps are always built in UTC (formatTime uses Date.UTC),
   so all to_timestamp() calls use AT TIME ZONE 'UTC' to match.
   Division uses 1000.0 (float) to avoid bigint integer truncation.
   ============================================================ */

// ---------------------------------------------------------------------------
// Internal — normalise authentication values from various storage formats
// ---------------------------------------------------------------------------
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
      } catch (_) { /* fall through */ }
    }
    return [...new Set(trimmed.split(',').map((v) => v.trim()).filter(Boolean))];
  }
  if (value == null) return [];
  const single = String(value).trim();
  return single ? [single] : [];
};

// ---------------------------------------------------------------------------
// Shared sub-expression: ms timestamp → seconds (float division, UTC)
// ---------------------------------------------------------------------------
const MS_TO_SEC = `(
  CASE
    WHEN starttime::text ~ '^[0-9]+$'
    THEN starttime::bigint / 1000.0
    ELSE NULL
  END
)`;

// ---------------------------------------------------------------------------
// completedCall — feetime > 0 means the call was answered and billed
// ---------------------------------------------------------------------------
const completedCall = literal(`
  CASE
    WHEN COALESCE(NULLIF(feetime::text, '')::numeric, 0) > 0
    THEN 1 ELSE 0
  END
`);

// ---------------------------------------------------------------------------
// failedCall — feetime = 0 or NULL means unanswered / failed
// ---------------------------------------------------------------------------
const failedCall = literal(`
  CASE
    WHEN COALESCE(NULLIF(feetime::text, '')::numeric, 0) = 0
    THEN 1 ELSE 0
  END
`);

// ---------------------------------------------------------------------------
// durationSec — call duration in seconds (same column as completedCall)
// ---------------------------------------------------------------------------
const durationSec = literal(`
  COALESCE(NULLIF(feetime::text, '')::numeric, 0)
`);

// ---------------------------------------------------------------------------
// revenue — customer-side billing fields
// ---------------------------------------------------------------------------
const revenue = literal(`
  (
    COALESCE(NULLIF(fee::text,       '')::numeric, 0) +
    COALESCE(NULLIF(tax::text,       '')::numeric, 0) +
    COALESCE(NULLIF(suitefee::text,  '')::numeric, 0) +
    COALESCE(NULLIF(incomefee::text, '')::numeric, 0) +
    COALESCE(NULLIF(incometax::text, '')::numeric, 0)
  )
`);

// ---------------------------------------------------------------------------
// cost — vendor-side billing fields
// ---------------------------------------------------------------------------
const cost = literal(`
  (
    COALESCE(NULLIF(agentfee::text,      '')::numeric, 0) +
    COALESCE(NULLIF(agenttax::text,      '')::numeric, 0) +
    COALESCE(NULLIF(agentsuitefee::text, '')::numeric, 0)
  )
`);

// ---------------------------------------------------------------------------
// Standalone helpers
// ---------------------------------------------------------------------------
const tax = literal(`COALESCE(NULLIF(tax::text, '')::numeric, 0)`);
const incomeFee = literal(`COALESCE(NULLIF(incomefee::text, '')::numeric, 0)`);
const agentFee  = literal(`COALESCE(NULLIF(agentfee::text,  '')::numeric, 0)`);

// ---------------------------------------------------------------------------
// hour — UTC hour bucket for hourly reports
// FIX: AT TIME ZONE 'UTC' ensures hour matches the UTC timestamps from
//      formatTime() in reportController.js regardless of DB server timezone
// ---------------------------------------------------------------------------
const hour = literal(`
  EXTRACT(
    HOUR FROM (
      to_timestamp(${MS_TO_SEC}) AT TIME ZONE 'UTC'
    )
  )
`);

// ---------------------------------------------------------------------------
// reportDate — UTC date for daily reports
// ---------------------------------------------------------------------------
const reportDate = literal(`
  DATE(
    to_timestamp(${MS_TO_SEC}) AT TIME ZONE 'UTC'
  )
`);

// ===========================================================================
// JS helper: strip VoIP routing prefix from calleee164
// ===========================================================================
/**
 * Strip the VoIP routing prefix from a calleee164 number so that the
 * remaining digits begin with the real international dialling code.
 *
 * Prefix patterns observed in live data:
 *   "4004#"  "2004#"  "2006"  "1004#"  "2011#"  → numeric trunk codes
 *   "apexcc" "arptel"                             → text gateway prefixes
 *
 * @param {string} number - raw calleee164 value
 * @returns {string}      - number with prefix removed
 */
const stripCallePrefix = (number) => {
  if (!number) return '';
  const s = String(number).trim();

  // Text prefixes (must check before numeric to avoid false matches)
  if (s.startsWith('apexcc')) return s.slice(6);
  if (s.startsWith('arptel')) return s.slice(6);

  // 4-digit numeric trunk + '#'  e.g. "4004#", "2004#", "1004#", "2011#"
  if (/^\d{4}#/.test(s)) return s.slice(5);

  // 4-digit numeric trunk without '#'  e.g. "2006", "4072"
  // Only strip if followed by more digits (avoids stripping short numbers)
  if (/^\d{4}\d{6,}/.test(s)) return s.slice(4);

  // Plain E.164 number — no prefix
  return s;
};

// ---------------------------------------------------------------------------
// getCountryFromNumber — look up country name from a calleee164 value
// ---------------------------------------------------------------------------
/**
 * @param {string}  number       - raw calleee164 value
 * @param {Array}   countryCodes - [{code, country_name}] sorted longest-first
 * @param {boolean} skipPrefix   - true → strip VoIP prefix first
 * @returns {string} country name, or 'Unknown'
 */
const getCountryFromNumber = (number, countryCodes, skipPrefix = false) => {
  if (!number) return 'Unknown';

  let cleaned = skipPrefix
    ? stripCallePrefix(String(number))
    : String(number).replace(/^(\+|00)/, '');

  // Sort longest code first (caller should pass pre-sorted, but guard here)
  const sorted = [...countryCodes].sort((a, b) => b.code.length - a.code.length);

  for (const cc of sorted) {
    if (cleaned.startsWith(cc.code)) return cc.country_name;
  }
  return 'Unknown';
};

// ===========================================================================
// JS helpers: CDR ↔ account matching (post-query partitioning)
// ===========================================================================

/**
 * Returns true when a CDR record matches an account's auth configuration.
 */
const matchesCDRAuthentication = (cdr, account, isVendor = false) => {
  if (!cdr || !account) return false;

  const authType = isVendor
    ? (account.vendorauthenticationType || account.customerauthenticationType)
    : account.customerauthenticationType;

  const authValue = isVendor
    ? (account.vendorauthenticationValue || account.customerauthenticationValue)
    : account.customerauthenticationValue;

  const authValues = normalizeAuthValues(authValue);

  // Fallback: code-based matching
  if (!authType || authValues.length === 0) {
    const code     = isVendor ? account.vendorCode     : account.customerCode;
    const cdrField = isVendor ? cdr.agentaccount       : cdr.customeraccount;
    return Boolean(code) && String(cdrField || '').includes(code);
  }

  // IP authentication
  if (authType === 'ip') {
    const cdrIp = String(isVendor ? (cdr.calleeip || '') : (cdr.callerip || '')).trim();
    return authValues.some((v) => cdrIp === String(v).trim());
  }

  // Custom field authentication
  if (authType === 'custom') {
    const normValues = authValues.map((v) => String(v).toLowerCase().trim());
    if (isVendor) {
      const agent     = String(cdr.agentaccount || '').toLowerCase().trim();
      const agentName = String(cdr.agentname    || '').toLowerCase().trim();
      return normValues.some((v) => agent.includes(v) || agentName.includes(v));
    } else {
      const cust     = String(cdr.customeraccount || '').toLowerCase().trim();
      const custName = String(cdr.customername    || '').toLowerCase().trim();
      return normValues.some((v) => cust.includes(v) || custName.includes(v));
    }
  }

  return false;
};

/** Returns the first matching account for a CDR, or null. */
const matchCDRToAccount = (cdr, accounts, isVendor = false) => {
  if (!cdr || !accounts || accounts.length === 0) return null;
  for (const account of accounts) {
    if (matchesCDRAuthentication(cdr, account, isVendor)) return account;
  }
  return null;
};

/** Splits CDRs into matched [{cdr, account}] and unmatched [cdr]. */
const partitionCDRsByMatch = (cdrs, accounts, isVendor = false) => {
  const matched   = [];
  const unmatched = [];
  cdrs.forEach((cdr) => {
    const account = matchCDRToAccount(cdr, accounts, isVendor);
    account ? matched.push({ cdr, account }) : unmatched.push(cdr);
  });
  return { matched, unmatched };
};

// ===========================================================================
// Exports
// ===========================================================================
module.exports = {
  // SQL literals
  completedCall,
  failedCall,
  durationSec,
  revenue,
  cost,
  tax,
  incomeFee,
  agentFee,
  hour,
  reportDate,

  // JS helpers
  stripCallePrefix,
  getCountryFromNumber,
  matchesCDRAuthentication,
  matchCDRToAccount,
  partitionCDRsByMatch,
};