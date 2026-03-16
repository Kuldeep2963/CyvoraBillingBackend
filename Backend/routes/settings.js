const express = require('express');
const router = express.Router();
const { getGlobalSettings, updateGlobalSettings } = require('../services/system-settings');
const { createNotification } = require('../services/notification-service');
const CDRRetentionService = require('../services/cdr-retention-service');

router.get('/', async (_req, res) => {
  try {
    const settings = await getGlobalSettings();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/', async (req, res) => {
  try {
    const role = req.user?.role?.toLowerCase();
    if (role !== 'admin') {
      return res.status(403).json({ error: 'Only admin can update settings' });
    }

    const settings = await updateGlobalSettings(req.body || {}, req.user?.email);

    await createNotification({
      title: 'Settings updated',
      message: `Global settings were updated by ${req.user?.email || 'admin'}.`,
      type: 'info',
      category: 'settings',
    });

    res.json(settings);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/retention/run', async (req, res) => {
  try {
    const role = req.user?.role?.toLowerCase();
    if (role !== 'admin') {
      return res.status(403).json({ error: 'Only admin can run retention cleanup' });
    }

    const service = new CDRRetentionService();
    const result = await service.runCleanup();
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
