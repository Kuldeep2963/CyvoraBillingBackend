const express = require('express');
const router = express.Router();
const Customer = require('../models/Account');
const User = require('../models/User');
const sequelize = require('../models/db');
const { Op } = require('sequelize');

// =======================
// SEARCH / STATS ROUTES (FIRST)
// =======================

// Get account statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const stats = await Customer.findAll({
      attributes: [
        'accountRole',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('balance')), 'totalBalance'],
        [sequelize.fn('SUM', sequelize.col('creditLimit')), 'totalCreditLimit']
      ],
      group: ['accountRole']
    });

    const totalAccounts = await Customer.count();
    const activeAccounts = await Customer.count({ where: { active: true } });

    res.json({
      byRole: stats,
      totals: {
        totalAccounts,
        activeAccounts,
        inactiveAccounts: totalAccounts - activeAccounts
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Autocomplete search
router.get('/search/autocomplete', async (req, res) => {
  try {
    const { query, role } = req.query;

    if (!query || query.length < 2) {
      return res.json([]);
    }

    const where = {
      [Op.or]: [
        { accountName: { [Op.iLike]: `%${query}%` } },
        { email: { [Op.iLike]: `%${query}%` } },
        { customerCode: { [Op.iLike]: `%${query}%` } },
        { vendorCode: { [Op.iLike]: `%${query}%` } }
      ]
    };

    if (role) {
      where.accountRole = role;
    }

    const accounts = await Customer.findAll({
      where,
      limit: 10,
      attributes: [
        'id',
        'accountId',
        'accountName',
        'accountRole',
        'customerCode',
        'vendorCode',
        'email',
        'phone',
        'gatewayId'
      ],
      order: [['accountName', 'ASC']]
    });

    res.json(accounts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =======================
// LOOKUP ROUTES
// =======================

router.get('/lookup/:accountId', async (req, res) => {
  try {
    const account = await Customer.findOne({
      where: { accountId: req.params.accountId }
    });

    if (!account) return res.status(404).json({ error: 'Account not found' });
    res.json(account);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/customer/:customerCode', async (req, res) => {
  try {
    const account = await Customer.findOne({
      where: { customerCode: req.params.customerCode }
    });

    if (!account) return res.status(404).json({ error: 'Customer not found' });
    res.json(account);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/vendor/:vendorCode', async (req, res) => {
  try {
    const account = await Customer.findOne({
      where: { vendorCode: req.params.vendorCode }
    });

    if (!account) return res.status(404).json({ error: 'Vendor not found' });
    res.json(account);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =======================
// MAIN LIST API
// =======================

router.get('/', async (req, res) => {
  try {
    const { role, status, search, page = 1, limit = 50 } = req.query;

    const where = {};

    if (role && role !== 'all') {
      if (role === 'vendor') {
        where.accountRole = { [Op.in]: ['vendor', 'both'] };
      } else if (role === 'customer') {
        where.accountRole = { [Op.in]: ['customer', 'both'] };
      } else {
        where.accountRole = role;
      }
    }

    if (status && status !== 'all') {
      if (status === 'active') where.active = true;
      else if (status === 'inactive') where.active = false;
      else where.accountStatus = status;
    }

    if (search) {
      where[Op.or] = [
        { accountName: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
        { phone: { [Op.iLike]: `%${search}%` } },
        { accountId: { [Op.iLike]: `%${search}%` } },
        { customerCode: { [Op.iLike]: `%${search}%` } },
        { vendorCode: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const offset = (page - 1) * limit;

    // Fetch accounts first, then manually fetch owners to avoid type mismatch in JOIN
    const { count, rows } = await Customer.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    // Manually fetch and attach owner information
    const ownerIds = [...new Set(rows.filter(r => r.accountOwner).map(r => r.accountOwner))];
    const owners = ownerIds.length > 0 
      ? await User.findAll({
          where: { id: { [Op.in]: ownerIds } },
          attributes: ['id', 'first_name', 'last_name', 'email'],
          raw: true
        })
      : [];
    const ownerMap = {};
    owners.forEach(owner => {
      ownerMap[owner.id] = owner;
    });
    
    // Attach owners to rows
    rows.forEach(row => {
      row.owner = ownerMap[row.accountOwner] || null;
    });

    res.json({
      accounts: rows.map(r => ({
        ...r.toJSON ? r.toJSON() : r,
        owner: r.owner
      })),
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / limit)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =======================
// SINGLE ACCOUNT (LAST)
// =======================

router.get('/:id', async (req, res) => {
  try {
    const accountId = parseInt(req.params.id);
    const account = await Customer.findByPk(accountId);
    
    // Manually fetch and attach owner
    if (account && account.accountOwner) {
      account.owner = await User.findByPk(account.accountOwner, {
        attributes: ['id', 'first_name', 'last_name', 'email']
      });
    } else {
      account.owner = null;
    }
    if (!account) return res.status(404).json({ error: 'Account not found' });
    res.json(account);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new account
router.post('/', async (req, res) => {
  try {
    const data = { ...req.body };

    // require last billing date
    if (!data.lastbillingdate) {
      return res.status(400).json({ error: 'lastbillingdate is required' });
    }

    // make billing-type-specific adjustments before creating
    if (data.billingType === 'prepaid') {
      // prepaid accounts should only use balance
      data.creditLimit = 0;
      data.originalCreditLimit = 0;
    } else if (data.billingType === 'postpaid') {
      // ensure original is seeded from incoming limit
      if (data.creditLimit != null) {
        data.originalCreditLimit = data.creditLimit;
      }
      // prepaid balance must be zero for postpaid accounts
      data.balance = 0;
    }

    // calculate next billing date based on lastbillingdate and cycle
    const computeNext = (last, cycle) => {
      const dt = new Date(last);
      switch (cycle) {
        case 'daily': dt.setDate(dt.getDate() + 1); break;
        case 'weekly': dt.setDate(dt.getDate() + 7); break;
        case 'biweekly': dt.setDate(dt.getDate() + 14); break;
        case 'monthly': dt.setMonth(dt.getMonth() + 1); break;
        case 'quarterly': dt.setMonth(dt.getMonth() + 3); break;
        case 'annually': dt.setFullYear(dt.getFullYear() + 1); break;
        default: break;
      }
      return dt.toISOString().split('T')[0];
    };
    if (data.lastbillingdate && data.billingCycle) {
      data.nextbillingdate = computeNext(data.lastbillingdate, data.billingCycle);
    }

    let account = await Customer.create(data);
    // reload to include owner info
    account = await Customer.findByPk(account.id);
    if (account && account.accountOwner) {
      account.owner = await User.findByPk(account.accountOwner, {
        attributes: ['id', 'first_name', 'last_name', 'email']
      });
    } else {
      account.owner = null;
    }
    res.status(201).json(account.toJSON ? account.toJSON() : account);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update account
router.put('/:id', async (req, res) => {
  try {
    const account = await Customer.findByPk(parseInt(req.params.id));
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const updates = { ...req.body };

    if (!updates.lastbillingdate) {
      return res.status(400).json({ error: 'lastbillingdate is required' });
    }

    // if billing type is changing, clear/seed appropriate fields
    if (updates.billingType && updates.billingType !== account.billingType) {
      if (updates.billingType === 'prepaid') {
        updates.creditLimit = 0;
        updates.originalCreditLimit = 0;
        // maybe keep existing balance
      } else if (updates.billingType === 'postpaid') {
        updates.balance = 0;
        if (updates.creditLimit != null) {
          updates.originalCreditLimit = updates.creditLimit;
        } else {
          // if no new limit supplied, keep old-credit as original
          updates.originalCreditLimit = account.creditLimit;
        }
      }
    }

    // otherwise just update originalCreditLimit when limit changes on postpaid
    if (updates.creditLimit != null && account.billingType === 'postpaid') {
      updates.originalCreditLimit = updates.creditLimit;
    }

    // recalc nextBilling if last or cycle changed
    const computeNext2 = (last, cycle) => {
      const dt = new Date(last);
      switch (cycle) {
        case 'daily': dt.setDate(dt.getDate() + 1); break;
        case 'weekly': dt.setDate(dt.getDate() + 7); break;
        case 'monthly': dt.setMonth(dt.getMonth() + 1); break;
        case 'quarterly': dt.setMonth(dt.getMonth() + 3); break;
        case 'annually': dt.setFullYear(dt.getFullYear() + 1); break;
        default: break;
      }
      return dt.toISOString().split('T')[0];
    };
    if (updates.lastbillingdate && updates.billingCycle) {
      updates.nextbillingdate = computeNext2(updates.lastbillingdate, updates.billingCycle);
    }

    await account.update(updates);
    // reload with owner
    const updated = await Customer.findByPk(account.id);
    if (updated && updated.accountOwner) {
      updated.owner = await User.findByPk(updated.accountOwner, {
        attributes: ['id', 'first_name', 'last_name', 'email']
      });
    } else {
      updated.owner = null;
    }
    res.json(updated.toJSON ? updated.toJSON() : updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete account
router.delete('/:id', async (req, res) => {
  try {
    const account = await Customer.findByPk(parseInt(req.params.id));
    if (!account) return res.status(404).json({ error: 'Account not found' });
    await account.destroy();
    res.json({ message: 'Account deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
