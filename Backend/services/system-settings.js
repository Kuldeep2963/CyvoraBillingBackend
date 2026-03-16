const SystemSetting = require('../models/SystemSetting');

const SETTINGS_KEY = 'global';

const DEFAULT_SETTINGS = {
  systemName: 'CDR Billing System',
  currency: 'USD',
  timezone: 'UTC',
  dataRetentionDays: 60,
  notificationPollingSeconds: 10,
  emailNotifications: true,
  notifyInvoiceGenerated: true,
  notifyPaymentDue: true,
  notifyDisputes: true,
  notifyErrors: true,
  notifyPaymentReceived: true,
  notificationEmail: '',
};

async function getGlobalSettings() {
  const row = await SystemSetting.findByPk(SETTINGS_KEY);
  if (!row) {
    return { ...DEFAULT_SETTINGS };
  }
  return {
    ...DEFAULT_SETTINGS,
    ...(row.value || {}),
  };
}

async function updateGlobalSettings(nextSettings, updatedBy) {
  const currentSettings = await getGlobalSettings();
  const merged = {
    ...currentSettings,
    ...nextSettings,
  };

  if (!Number.isFinite(Number(merged.dataRetentionDays))) {
    merged.dataRetentionDays = DEFAULT_SETTINGS.dataRetentionDays;
  }
  merged.dataRetentionDays = Math.max(30, Math.min(3650, Number(merged.dataRetentionDays)));

  if (!Number.isFinite(Number(merged.notificationPollingSeconds))) {
    merged.notificationPollingSeconds = DEFAULT_SETTINGS.notificationPollingSeconds;
  }
  merged.notificationPollingSeconds = Math.max(5, Math.min(60, Number(merged.notificationPollingSeconds)));

  await SystemSetting.upsert({
    key: SETTINGS_KEY,
    value: merged,
    updatedBy: updatedBy || null,
  });

  return merged;
}

module.exports = {
  DEFAULT_SETTINGS,
  getGlobalSettings,
  updateGlobalSettings,
};
