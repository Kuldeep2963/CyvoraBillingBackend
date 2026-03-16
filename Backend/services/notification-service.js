const Notification = require('../models/Notification');

async function createNotification({ title, message, type = 'info', category = 'system', metadata = null }) {
  if (!title || !message) {
    throw new Error('title and message are required');
  }

  return Notification.create({
    title,
    message,
    type,
    category,
    metadata,
    isRead: false,
  });
}

async function listNotifications({ limit = 30, unreadOnly = false } = {}) {
  const normalizedLimit = Math.max(1, Math.min(100, Number(limit) || 30));
  const where = unreadOnly ? { isRead: false } : {};

  const rows = await Notification.findAll({
    where,
    order: [['createdAt', 'DESC']],
    limit: normalizedLimit,
  });

  const unreadCount = await Notification.count({ where: { isRead: false } });

  return {
    notifications: rows,
    unreadCount,
  };
}

async function markRead(id, isRead = true) {
  const row = await Notification.findByPk(id);
  if (!row) {
    return null;
  }
  row.isRead = isRead;
  await row.save();
  return row;
}

async function markAllRead() {
  await Notification.update({ isRead: true }, { where: { isRead: false } });
}

module.exports = {
  createNotification,
  listNotifications,
  markRead,
  markAllRead,
};
