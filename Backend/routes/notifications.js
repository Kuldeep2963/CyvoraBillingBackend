const express = require('express');
const router = express.Router();
const { listNotifications, markRead, markAllRead, createNotification } = require('../services/notification-service');

router.get('/', async (req, res) => {
  try {
    const limit = req.query.limit;
    const unreadOnly = req.query.unreadOnly === 'true';
    const viewerRole = String(req.user?.role || '').toLowerCase() || null;
    const viewerId = req.user?.id || null;
    const result = await listNotifications({ limit, unreadOnly, viewerRole, viewerId });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id/read', async (req, res) => {
  try {
    const row = await markRead(req.params.id, {
      isRead: true,
      viewerRole: req.user?.role,
      viewerId: req.user?.id,
    });
    if (!row) return res.status(404).json({ error: 'Notification not found' });
    res.json(row);
  } catch (error) {
    if (error.message === 'Not authorized to modify this notification') {
      return res.status(403).json({ error: error.message });
    }
    res.status(400).json({ error: error.message });
  }
});

router.patch('/read-all', async (req, res) => {
  try {
    await markAllRead({
      viewerRole: req.user?.role,
      viewerId: req.user?.id,
    });
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
      audienceRole: req.body?.audienceRole || null,
      metadata: { createdBy: req.user?.email || 'admin' },
    });

    res.status(201).json(notification);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
