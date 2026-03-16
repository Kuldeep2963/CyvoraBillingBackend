const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const sequelize = require('../models/db');
const CDR = require('../models/CDR');
const { createNotification } = require('../services/notification-service');

// Get CDR total count (fast and memory-safe for dashboards/settings)
router.get('/count', async (_req, res) => {
  try {
    const count = await CDR.count();
    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get aggregate CDR stats for a customer/vendor mapping without returning full row sets
router.get('/stats', async (req, res) => {
  try {
    const customerCode = String(req.query.customerCode || '').trim();
    const vendorCode = String(req.query.vendorCode || '').trim();

    if (!customerCode && !vendorCode) {
      return res.status(400).json({ error: 'customerCode or vendorCode is required' });
    }

    const where = {
      [Op.or]: [],
    };

    if (customerCode) {
      where[Op.or].push(
        sequelize.where(
          sequelize.fn('TRIM', sequelize.col('customeraccount')),
          { [Op.eq]: customerCode }
        )
      );
    }
    if (vendorCode) {
      where[Op.or].push(
        sequelize.where(
          sequelize.fn('TRIM', sequelize.col('agentaccount')),
          { [Op.eq]: vendorCode }
        )
      );
    }

    const [result] = await CDR.findAll({
      where,
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'totalCalls'],
        [sequelize.literal("COALESCE(SUM(COALESCE(NULLIF(regexp_replace(COALESCE(feetime, ''), '[^0-9eE+\\\\-.]', '', 'g'), ''), '0')::double precision), 0)"), 'totalDuration'],
        [sequelize.literal("COALESCE(SUM(COALESCE(NULLIF(regexp_replace(COALESCE(fee, ''), '[^0-9eE+\\\\-.]', '', 'g'), ''), '0')::double precision), 0)"), 'totalRevenue'],
        [sequelize.literal("COALESCE(SUM(COALESCE(NULLIF(regexp_replace(COALESCE(tax, ''), '[^0-9eE+\\\\-.]', '', 'g'), ''), '0')::double precision), 0)"), 'totalTax'],
        [sequelize.literal("COALESCE(SUM(CASE WHEN COALESCE(NULLIF(regexp_replace(COALESCE(endreason, ''), '[^0-9\\\\-]', '', 'g'), ''), '-1')::integer = 0 THEN 1 ELSE 0 END), 0)"), 'answeredCalls'],
      ],
      raw: true,
    });

    res.json({
      totalCalls: Number(result?.totalCalls || 0),
      totalDuration: Number(result?.totalDuration || 0),
      totalRevenue: Number(result?.totalRevenue || 0),
      totalTax: Number(result?.totalTax || 0),
      answeredCalls: Number(result?.answeredCalls || 0),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all CDRs
router.get('/', async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(5000, Number(req.query.limit) || 1000));
    const page = Math.max(1, Number(req.query.page) || 1);
    const offset = (page - 1) * limit;

    const cdrs = await CDR.findAll({
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });
    res.json(cdrs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upload multiple CDRs (Bulk create)
router.post('/bulk', async (req, res) => {
  try {
    console.log('Received bulk CDR upload request');
    console.log('Number of records:', req.body.length);
    console.log('First record sample:', req.body[0]);
    
    const cdrs = await CDR.bulkCreate(req.body, {
      validate: true,
      ignoreDuplicates: true
    });
    
    console.log(`Successfully created ${cdrs.length} CDRs`);

    await createNotification({
      title: 'CDR file processed',
      message: `${cdrs.length} CDR records were uploaded successfully.`,
      type: 'success',
      category: 'cdr',
      metadata: { count: cdrs.length },
    });

    res.status(201).json({ 
      message: `${cdrs.length} CDRs uploaded successfully`,
      count: cdrs.length 
    });
  } catch (err) {
    console.error('Error creating CDRs:', err.message);
    console.error('Error details:', err);
    res.status(400).json({ error: err.message });
  }
});

// Create single CDR
router.post('/', async (req, res) => {
  try {
    const cdr = await CDR.create(req.body);

    await createNotification({
      title: 'CDR created',
      message: `CDR ${cdr.id} was created.`,
      type: 'info',
      category: 'cdr',
      metadata: { cdrId: cdr.id },
    });

    res.status(201).json(cdr);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update CDR
router.put('/:id', async (req, res) => {
  try {
    const cdr = await CDR.findByPk(req.params.id);
    if (!cdr) {
      return res.status(404).json({ error: 'CDR not found' });
    }
    await cdr.update(req.body);
    res.json(cdr);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete CDR
router.delete('/:id', async (req, res) => {
  try {
    const cdr = await CDR.findByPk(req.params.id);
    if (!cdr) {
      return res.status(404).json({ error: 'CDR not found' });
    }
    await cdr.destroy();
    res.json({ message: 'CDR deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
