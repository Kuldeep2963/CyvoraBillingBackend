const sequelize = require('../config/database');
const Account = require('../models/Account');
const {
  addDays,
  calculateNextBillingDate,
  getInitialLastBillingDate,
  buildBillingUpdates,
  normalizeDateOnly,
} = require('../utils/CalendarBillingCalculator');

(async () => {
  try {
    await sequelize.authenticate();
    console.log('Connected to DB. Starting billing cursor resync...');

    const accounts = await Account.findAll({ where: {} });
    let updated = 0;
    for (const acct of accounts) {
      const account = acct;
      const cycle = account.billingCycle || 'monthly';
      const last = normalizeDateOnly(account.customerLastBillingDate) || normalizeDateOnly(account.lastbillingdate) || null;
      const next = normalizeDateOnly(account.customerNextBillingDate) || normalizeDateOnly(account.nextbillingdate) || null;

      let desired = {};

      if (last && next) {
        const expectedNext = calculateNextBillingDate(last, cycle);
        if (expectedNext !== next) {
          // Derive from stored next (assume next might be a trigger or EOM)
          const endCandidate = addDays(next, -1);
          const deduced = buildBillingUpdates(account, 'customer', endCandidate);
          if (deduced && deduced.customerLastBillingDate) {
            desired = deduced;
          }
        }
      } else if (!last && next) {
        const endCandidate = addDays(next, -1);
        const deduced = buildBillingUpdates(account, 'customer', endCandidate);
        if (deduced && deduced.customerLastBillingDate) desired = deduced;
      } else if (last && !next) {
        const nextCalc = calculateNextBillingDate(last, cycle);
        desired = {
          customerLastBillingDate: last,
          customerNextBillingDate: nextCalc,
          lastbillingdate: last,
          nextbillingdate: nextCalc,
        };
      } else {
        const initLast = getInitialLastBillingDate(cycle, account.billingStartDate || account.createdAt || new Date());
        const nextCalc = calculateNextBillingDate(initLast, cycle);
        desired = {
          customerLastBillingDate: initLast,
          customerNextBillingDate: nextCalc,
          lastbillingdate: initLast,
          nextbillingdate: nextCalc,
        };
      }

      // Apply updates if they change anything
      if (Object.keys(desired).length > 0) {
        const diff = {};
        for (const k of Object.keys(desired)) {
          const current = normalizeDateOnly(account[k]) || null;
          const want = desired[k] || null;
          if (current !== want) diff[k] = want;
        }

        if (Object.keys(diff).length > 0) {
          const t = await sequelize.transaction();
          try {
            await account.update(diff, { transaction: t });
            await t.commit();
            updated++;
            console.log(`Account ${account.accountId} updated:`, diff);
          } catch (e) {
            await t.rollback();
            console.error(`Failed to update account ${account.accountId}:`, e.message);
          }
        }
      }
    }

    console.log(`Resync complete. ${updated} accounts updated.`);
    process.exit(0);
  } catch (err) {
    console.error('Resync failed:', err);
    process.exit(1);
  }
})();
