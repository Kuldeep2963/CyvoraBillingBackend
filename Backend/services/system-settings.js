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
  // Validation bounds - can be updated via API
  dataRetentionMinDays: process.env.RETENTION_MIN_DAYS ? parseInt(process.env.RETENTION_MIN_DAYS, 10) : 2,
  dataRetentionMaxDays: process.env.RETENTION_MAX_DAYS ? parseInt(process.env.RETENTION_MAX_DAYS, 10) : 90,
  notificationPollingMinSeconds: process.env.NOTIFICATION_POLLING_MIN_SECONDS ? parseInt(process.env.NOTIFICATION_POLLING_MIN_SECONDS, 10) : 5,
  notificationPollingMaxSeconds: process.env.NOTIFICATION_POLLING_MAX_SECONDS ? parseInt(process.env.NOTIFICATION_POLLING_MAX_SECONDS, 10) : 3600,
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

  // Get validation bounds from live settings, with fallback to defaults
  const retentionMinDays = currentSettings.dataRetentionMinDays ?? DEFAULT_SETTINGS.dataRetentionMinDays;
  const retentionMaxDays = currentSettings.dataRetentionMaxDays ?? DEFAULT_SETTINGS.dataRetentionMaxDays;
  const pollingMinSeconds = currentSettings.notificationPollingMinSeconds ?? DEFAULT_SETTINGS.notificationPollingMinSeconds;
  const pollingMaxSeconds = currentSettings.notificationPollingMaxSeconds ?? DEFAULT_SETTINGS.notificationPollingMaxSeconds;

  // Validate dataRetentionDays
  if (!Number.isFinite(Number(merged.dataRetentionDays))) {
    merged.dataRetentionDays = DEFAULT_SETTINGS.dataRetentionDays;
  } else {
    const days = Number(merged.dataRetentionDays);
    if (days < retentionMinDays || days > retentionMaxDays) {
      throw new Error(`CDR data retention (days) must be between ${retentionMinDays} and ${retentionMaxDays}`);
    }
    merged.dataRetentionDays = days;
  }

  // Validate notificationPollingSeconds
  if (!Number.isFinite(Number(merged.notificationPollingSeconds))) {
    merged.notificationPollingSeconds = DEFAULT_SETTINGS.notificationPollingSeconds;
  } else {
    const seconds = Number(merged.notificationPollingSeconds);
    if (seconds < pollingMinSeconds || seconds > pollingMaxSeconds) {
      throw new Error(`Notification polling interval (seconds) must be between ${pollingMinSeconds} and ${pollingMaxSeconds}`);
    }
    merged.notificationPollingSeconds = seconds;
  }

  // Preserve validation bounds (don't allow changing them in regular updates)
  merged.dataRetentionMinDays = retentionMinDays;
  merged.dataRetentionMaxDays = retentionMaxDays;
  merged.notificationPollingMinSeconds = pollingMinSeconds;
  merged.notificationPollingMaxSeconds = pollingMaxSeconds;

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
