const express = require('express');
const router = express.Router();
const CDR = require('../models/CDR');

// Get all CDRs
router.get('/', async (req, res) => {
  try {
    const cdrs = await CDR.findAll();
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
