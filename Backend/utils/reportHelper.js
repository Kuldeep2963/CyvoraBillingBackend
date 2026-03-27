const { literal } = require('sequelize');

module.exports = {
  completedCall: literal(`
    CASE
      WHEN feetime::text ~ '^[0-9]+(\\.[0-9]+)?$'
           AND feetime::numeric > 0
      THEN 1 ELSE 0
    END
  `),

  failedCall: literal(`
    CASE
      WHEN feetime::text ~ '^[0-9]+(\\.[0-9]+)?$'
           AND feetime::numeric = 0
      THEN 1 ELSE 0
    END
  `),

  durationSec: literal(`
    CASE
      WHEN feetime::text ~ '^[0-9]+(\\.[0-9]+)?$'
      THEN feetime::numeric
      ELSE 0
    END
  `),

  revenue: literal(`
  (
    COALESCE(NULLIF(fee::text, '')::numeric, 0) +
    COALESCE(NULLIF(tax::text, '')::numeric, 0) +
    COALESCE(NULLIF(suitefee::text, '')::numeric, 0) +
    COALESCE(NULLIF(incomefee::text, '')::numeric, 0) +
    COALESCE(NULLIF(incometax::text, '')::numeric, 0)
  )
`),

  cost: literal(`
  (
    COALESCE(NULLIF(agentfee::text, '')::numeric, 0) +
    COALESCE(NULLIF(agenttax::text, '')::numeric, 0) +
    COALESCE(NULLIF(agentsuitefee::text, '')::numeric, 0)
  )
`),

  tax: literal(`
    CASE
      WHEN tax::text ~ '^[0-9]+(\\.[0-9]+)?$'
      THEN tax::numeric
      ELSE 0
    END
  `),

  incomeFee: literal(`
    CASE
      WHEN incomefee::text ~ '^[0-9]+(\\.[0-9]+)?$'
      THEN incomefee::numeric
      ELSE 0
    END
  `),

  agentFee: literal(`
    CASE
      WHEN agentfee::text ~ '^[0-9]+(\\.[0-9]+)?$'
      THEN agentfee::numeric
      ELSE 0
    END
  `),

  hour: literal(`
    EXTRACT(
      HOUR FROM
      to_timestamp(
        CASE
          WHEN starttime::text ~ '^[0-9]+$'
          THEN starttime::bigint
          ELSE NULL
        END / 1000
      )
    )
  `),

  reportDate: literal(`
    DATE(
      to_timestamp(
        CASE
          WHEN starttime::text ~ '^[0-9]+$'
          THEN starttime::bigint
          ELSE NULL
        END / 1000
      )
    )
  `),

  /**
   * Check if a CDR matches an account based on authentication values
   * @param {Object} cdr - CDR record
   * @param {Object} account - Account record
   * @param {boolean} isVendor - Is this a vendor report?
   * @returns {boolean} - Does the CDR match this account?
   */
  matchesCDRAuthentication: (cdr, account, isVendor = false) => {
    if (!cdr || !account) return false;

    const authType = isVendor 
      ? (account.vendorauthenticationType || account.customerauthenticationType)
      : account.customerauthenticationType;
    const authValue = isVendor
      ? (account.vendorauthenticationValue || account.customerauthenticationValue)
      : account.customerauthenticationValue;

    if (!authType || !authValue) {
      // Fallback to code matching
      const code = isVendor ? account.vendorCode : account.customerCode;
      const cdrField = isVendor ? cdr.agentaccount : cdr.customeraccount;
      return code && String(cdrField).includes(code);
    }

    // 1️⃣ IP authentication
    if (authType === 'ip') {
      const cdrIp = isVendor ? cdr.calleeip : cdr.callerip;
      return String(cdrIp).trim() === String(authValue).trim();
    }

    // 2️⃣ Custom field authentication
    if (authType === 'custom') {
      const normValue = String(authValue).toLowerCase().trim();
      if (isVendor) {
        const agent = String(cdr.agentaccount || '').toLowerCase().trim();
        const agentName = String(cdr.agentname || '').toLowerCase().trim();
        return agent.includes(normValue) || agentName.includes(normValue);
      } else {
        const cust = String(cdr.customeraccount || '').toLowerCase().trim();
        const custName = String(cdr.customername || '').toLowerCase().trim();
        return cust.includes(normValue) || custName.includes(normValue);
      }
    }

    return false;
  },

  /**
   * Match a CDR to the best account based on authentication
   * @param {Object} cdr - CDR record
   * @param {Array} accounts - Array of account records
   * @param {boolean} isVendor - Is this a vendor report?
   * @returns {Object|null} - Matching account or null if no match
   */
  matchCDRToAccount: (cdr, accounts, isVendor = false) => {
    if (!cdr || !accounts || accounts.length === 0) return null;

    const H = module.exports;

    // Find first account that this CDR matches
    for (const account of accounts) {
      if (H.matchesCDRAuthentication(cdr, account, isVendor)) {
        return account;
      }
    }

    return null;
  },

  /**
   * Partition CDRs into matched and unmatched groups
   * @param {Array} cdrs - Array of CDR records
   * @param {Array} accounts - Array of account records
   * @param {boolean} isVendor - Is this a vendor report?
   * @returns {Object} - { matched: [{cdr, account}], unmatched: [cdrs] }
   */
  partitionCDRsByMatch: (cdrs, accounts, isVendor = false) => {
    const matched = [];
    const unmatched = [];

    const H = module.exports;

    cdrs.forEach(cdr => {
      const account = H.matchCDRToAccount(cdr, accounts, isVendor);
      if (account) {
        matched.push({ cdr, account });
      } else {
        unmatched.push(cdr);
      }
    });

    return { matched, unmatched };
  }
};
