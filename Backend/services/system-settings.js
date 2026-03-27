const SystemSetting = require('../models/SystemSetting');

const SETTINGS_KEY = 'global';

const DEFAULT_SETTINGS = {
  systemName: 'CDR Billing System',
  currency: 'USD',
  timezone: 'UTC',
  dataRetentionDays: 60,
  notificationPollingSeconds: 10,
  lastProcessedCdrFilename: '',
  lastProcessedCdrTimestampUtc: '',
  emailNotifications: true,
  notifyInvoiceGenerated: true,
  notifyPaymentDue: true,
  notifyDisputes: true,
  notifyErrors: true,
  notifyPaymentReceived: true,
  notificationEmail: '',
};

const SETTINGS_KEYS = Object.keys(DEFAULT_SETTINGS);

const normalizeIncomingSettings = (raw = {}) => {
  const source = raw && typeof raw === 'object' ? raw : {};

  // Map known legacy keys to canonical settings keys.
  const legacyMapped = {
    ...source,
    dataRetentionDays: source.dataRetentionDays ?? source.dataretentiondays,
    notificationPollingSeconds:
      source.notificationPollingSeconds ?? source.notificationpollingseconds,
  };

  // Keep only supported settings keys.
  return SETTINGS_KEYS.reduce((acc, key) => {
    if (legacyMapped[key] !== undefined) {
      acc[key] = legacyMapped[key];
    }
    return acc;
  }, {});
};

async function getGlobalSettings() {
  const row = await SystemSetting.findByPk(SETTINGS_KEY);
  if (!row) {
    return { ...DEFAULT_SETTINGS };
  }
  const normalized = normalizeIncomingSettings(row.value || {});
  return {
    ...DEFAULT_SETTINGS,
    ...normalized,
  };
}

async function updateGlobalSettings(nextSettings, updatedBy) {
  const currentSettings = await getGlobalSettings();
  const normalizedNext = normalizeIncomingSettings(nextSettings);
  const merged = {
    ...currentSettings,
    ...normalizedNext,
  };

  if (!Number.isFinite(Number(merged.dataRetentionDays))) {
    merged.dataRetentionDays = DEFAULT_SETTINGS.dataRetentionDays;
  }
  merged.dataRetentionDays = Math.max(30, Math.min(3650, Number(merged.dataRetentionDays)));

  if (!Number.isFinite(Number(merged.notificationPollingSeconds))) {
    merged.notificationPollingSeconds = DEFAULT_SETTINGS.notificationPollingSeconds;
  }
  merged.notificationPollingSeconds = Math.max(5, Math.min(3600, Number(merged.notificationPollingSeconds)));

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
