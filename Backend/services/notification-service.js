const Notification = require('../models/Notification');
const NotificationRead = require('../models/NotificationRead');
const sequelize = require('../models/db');
const { Op } = require('sequelize');
const { getGlobalSettings } = require('./system-settings');

const SETTINGS_GATE_BY_CATEGORY = {
  invoice: 'notifyInvoiceGenerated',
  payment_due: 'notifyPaymentDue',
  payment_received: 'notifyPaymentReceived',
  dispute: 'notifyDisputes',
};

const BULK_INSERT_CHUNK_SIZE = 500;

const normalizeRole = (value) => String(value || '').trim().toLowerCase() || null;

const canViewerAccessNotification = (notification, viewerRole) => {
  const normalizedViewerRole = normalizeRole(viewerRole);
  const normalizedAudienceRole = normalizeRole(notification?.audienceRole);

  if (!normalizedAudienceRole) return true;
  if (!normalizedViewerRole) return false;
  return normalizedAudienceRole === normalizedViewerRole;
};

const buildAudienceWhere = (viewerRole) => {
  const normalizedViewerRole = normalizeRole(viewerRole);
  if (!normalizedViewerRole) {
    return {};
  }

  return {
    [Op.or]: [
      { audienceRole: null },
      { audienceRole: normalizedViewerRole },
    ],
  };
};

const shouldCreateNotification = async ({ type, category, metadata }) => {
  const settings = await getGlobalSettings();

  const explicitGate = metadata && typeof metadata === 'object' ? metadata.settingGate : null;
  const gateKey = explicitGate || SETTINGS_GATE_BY_CATEGORY[String(category || '').toLowerCase()] || null;

  if (gateKey && settings[gateKey] === false) {
    return false;
  }

  if (String(type || '').toLowerCase() === 'error' && settings.notifyErrors === false) {
    return false;
  }

  return true;
};

async function createNotification({ title, message, type = 'info', category = 'system', metadata = null, audienceRole = null }) {
  if (!title || !message) {
    throw new Error('title and message are required');
  }

  const allowed = await shouldCreateNotification({ type, category, metadata });
  if (!allowed) {
    return null;
  }

  return Notification.create({
    title,
    message,
    type,
    category,
    audienceRole,
    metadata,
    isRead: false,
  });
}

async function listNotifications({ limit = 30, unreadOnly = false, viewerRole = null, viewerId = null } = {}) {
  const normalizedLimit = Math.max(1, Math.min(100, Number(limit) || 30));
  const where = buildAudienceWhere(viewerRole);
  const normalizedViewerId = Number.isFinite(Number(viewerId)) ? Number(viewerId) : null;

  if (unreadOnly && normalizedViewerId) {
    where[Op.and] = [
      sequelize.literal(
        `NOT EXISTS (SELECT 1 FROM notification_reads nr WHERE nr.notification_id = "Notification"."id" AND nr.user_id = ${normalizedViewerId})`
      ),
    ];
  } else if (unreadOnly) {
    where.isRead = false;
  }

  const rows = await Notification.findAll({
    where,
    order: [['createdAt', 'DESC']],
    limit: normalizedLimit,
  });

  const notifications = rows.map((row) => row.toJSON());
  const notificationIds = notifications.map((row) => row.id);

  let readMap = new Set();
  if (normalizedViewerId && notificationIds.length > 0) {
    const reads = await NotificationRead.findAll({
      where: {
        userId: normalizedViewerId,
        notificationId: {
          [Op.in]: notificationIds,
        },
      },
      attributes: ['notificationId'],
      raw: true,
    });
    readMap = new Set(reads.map((item) => item.notificationId));
  }

  const shapedNotifications = notifications.map((notification) => ({
    ...notification,
    isRead: normalizedViewerId ? readMap.has(notification.id) : Boolean(notification.isRead),
  }));

  const unreadWhere = buildAudienceWhere(viewerRole);
  unreadWhere.isRead = false;

  let unreadCount;
  if (normalizedViewerId) {
    const unreadScopedWhere = buildAudienceWhere(viewerRole);
    unreadScopedWhere[Op.and] = [
      sequelize.literal(
        `NOT EXISTS (SELECT 1 FROM notification_reads nr WHERE nr.notification_id = "Notification"."id" AND nr.user_id = ${normalizedViewerId})`
      ),
    ];
    unreadCount = await Notification.count({ where: unreadScopedWhere });
  } else {
    unreadCount = await Notification.count({ where: unreadWhere });
  }


  return {
    notifications: shapedNotifications,
    unreadCount,
  };
}

async function markRead(id, { isRead = true, viewerRole = null, viewerId = null } = {}) {
  const row = await Notification.findByPk(id);
  if (!row) {
    return null;
  }

  if (!canViewerAccessNotification(row, viewerRole)) {
    throw new Error('Not authorized to modify this notification');
  }

  const normalizedViewerId = Number.isFinite(Number(viewerId)) ? Number(viewerId) : null;

  if (normalizedViewerId) {
    if (isRead) {
      await NotificationRead.findOrCreate({
        where: {
          notificationId: row.id,
          userId: normalizedViewerId,
        },
        defaults: {
          readAt: new Date(),
        },
      });
    } else {
      await NotificationRead.destroy({
        where: {
          notificationId: row.id,
          userId: normalizedViewerId,
        },
      });
    }

    return {
      ...row.toJSON(),
      isRead: Boolean(isRead),
    };
  }

  row.isRead = isRead;
  await row.save();
  return row.toJSON();
}

async function markAllRead({ viewerRole = null, viewerId = null } = {}) {
  const normalizedViewerId = Number.isFinite(Number(viewerId)) ? Number(viewerId) : null;

  if (normalizedViewerId) {
    const where = buildAudienceWhere(viewerRole);
    const notifications = await Notification.findAll({
      where,
      attributes: ['id'],
      raw: true,
    });

    if (notifications.length === 0) {
      return;
    }

    for (let index = 0; index < notifications.length; index += BULK_INSERT_CHUNK_SIZE) {
      const chunk = notifications.slice(index, index + BULK_INSERT_CHUNK_SIZE);
      await NotificationRead.bulkCreate(
        chunk.map((notification) => ({
          notificationId: notification.id,
          userId: normalizedViewerId,
          readAt: new Date(),
        })),
        { ignoreDuplicates: true }
      );
    }
    return;
  }

  const where = buildAudienceWhere(viewerRole);
  where.isRead = false;
  await Notification.update({ isRead: true }, { where });
}

module.exports = {
  createNotification,
  listNotifications,
  markRead,
  markAllRead,
};
