const express = require('express');
const router = express.Router();
const { listNotifications, markRead, markAllRead, createNotification } = require('../services/notification-service');

router.get('/', async (req, res) => {
  try {
    const limit = req.query.limit;
    const unreadOnly = req.query.unreadOnly === 'true';
    const result = await listNotifications({ limit, unreadOnly });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id/read', async (req, res) => {
  try {
    const row = await markRead(req.params.id, true);
    if (!row) return res.status(404).json({ error: 'Notification not found' });
    res.json(row);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.patch('/read-all', async (_req, res) => {
  try {
    await markAllRead();
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/test', async (req, res) => {
  try {
    const role = req.user?.role?.toLowerCase();
    if (role !== 'admin') {
      return res.status(403).json({ error: 'Only admin can create test notifications' });
    }

    const notification = await createNotification({
      title: req.body?.title || 'Test notification',
      message: req.body?.message || 'This is a test event from Settings page.',
      type: req.body?.type || 'info',
      category: req.body?.category || 'test',
      metadata: { createdBy: req.user?.email || 'admin' },
    });

    res.status(201).json(notification);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
