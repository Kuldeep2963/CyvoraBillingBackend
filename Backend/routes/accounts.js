const express = require('express');
const router = express.Router();
const Customer = require('../models/Account');
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
      where.accountRole = role;
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

    const { count, rows } = await Customer.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    res.json({
      accounts: rows,
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
    const account = await Customer.findByPk(req.params.id);
    if (!account) return res.status(404).json({ error: 'Account not found' });
    res.json(account);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new account
router.post('/', async (req, res) => {
  try {
    const account = await Customer.create(req.body);
    res.status(201).json(account);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update account
router.put('/:id', async (req, res) => {
  try {
    const account = await Customer.findByPk(req.params.id);
    if (!account) return res.status(404).json({ error: 'Account not found' });
    await account.update(req.body);
    res.json(account);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete account
router.delete('/:id', async (req, res) => {
  try {
    const account = await Customer.findByPk(req.params.id);
    if (!account) return res.status(404).json({ error: 'Account not found' });
    await account.destroy();
    res.json({ message: 'Account deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
