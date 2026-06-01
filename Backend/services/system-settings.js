const { Op } = require('sequelize');
const SystemSetting = require('../models/SystemSetting');

const SETTINGS_KEY = 'global';

const BILLING_CLASS_RESERVED_KEYS = new Set([SETTINGS_KEY]);

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
  syncEmailProfiles: false,
  billingSmtpEmail: '',
  billingSmtpPassword: '',
  billingSmtpHost: '',
  billingSmtpPort: '',
  billingSmtpSecure: false,
  billingSmtpCertificateCheck: false,
  reportsSmtpEmail: '',
  reportsSmtpPassword: '',
  reportsSmtpHost: '',
  reportsSmtpPort: '',
  reportsSmtpSecure: false,
  reportsSmtpCertificateCheck: false,
  ratesSmtpEmail: '',
  ratesSmtpPassword: '',
  ratesSmtpHost: '',
  ratesSmtpPort: '',
  ratesSmtpSecure: false,
  ratesSmtpCertificateCheck: false,
  managementSmtpEmail: '',
  managementSmtpPassword: '',
  managementSmtpHost: '',
  managementSmtpPort: '',
  managementSmtpSecure: false,
  managementSmtpCertificateCheck: false,
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

const normalizeBillingClassTag = (tag) => String(tag || '').trim().toLowerCase();

const normalizeAddressLines = (value, fallback = []) => {
  if (Array.isArray(value)) {
    const lines = value
      .map((line) => String(line || '').trim())
      .filter(Boolean);
    return lines.length ? lines : fallback;
  }

  if (typeof value === 'string') {
    const lines = value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    return lines.length ? lines : fallback;
  }

  return fallback;
};

const normalizeBillingClassProfile = (tag, rawProfile = {}) => {
  const normalizedTag = normalizeBillingClassTag(tag);
  const base = {
    tag: normalizedTag,
    displayName: normalizedTag,
    companyName: '',
    addressLines: [],
    email: '',
    phone: '',
    paymentInfo: {
      beneficiaryName: '',
      bankName: '',
      swiftCode: '',
      accountNo: '',
      iban: '',
      bankAddress: '',
      accountCurrency: '',
    },
    footerText: '',
  };

  const source = rawProfile && typeof rawProfile === 'object' ? rawProfile : {};
  const paymentInfoSource = source.paymentInfo && typeof source.paymentInfo === 'object'
    ? source.paymentInfo
    : {};

  return {
    ...base,
    ...source,
    tag: normalizedTag || base.tag,
    displayName: String(source.displayName || base.displayName || '').trim() || normalizedTag,
    companyName: String(source.companyName || base.companyName || '').trim(),
    addressLines: normalizeAddressLines(source.addressLines, base.addressLines),
    email: String(source.email || base.email || '').trim(),
    phone: String(source.phone || base.phone || '').trim(),
    paymentInfo: {
      ...base.paymentInfo,
      ...paymentInfoSource,
      beneficiaryName: String(paymentInfoSource.beneficiaryName || base.paymentInfo.beneficiaryName || '').trim(),
      bankName: String(paymentInfoSource.bankName || base.paymentInfo.bankName || '').trim(),
      swiftCode: String(paymentInfoSource.swiftCode || base.paymentInfo.swiftCode || '').trim(),
      accountNo: String(paymentInfoSource.accountNo || base.paymentInfo.accountNo || '').trim(),
      iban: String(paymentInfoSource.iban || base.paymentInfo.iban || '').trim(),
      bankAddress: String(paymentInfoSource.bankAddress || base.paymentInfo.bankAddress || '').trim(),
      accountCurrency: String(paymentInfoSource.accountCurrency || base.paymentInfo.accountCurrency || '').trim(),
    },
    footerText: String(source.footerText || base.footerText || '').trim(),
  };
};

const isBillingClassProfileValue = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;

  const hasCompanyFields = [
    'companyName',
    'displayName',
    'addressLines',
    'paymentInfo',
    'footerText',
  ].some((key) => Object.prototype.hasOwnProperty.call(value, key));

  const looksLikeCheckpoint = Object.prototype.hasOwnProperty.call(value, 'flowno')
    && Object.keys(value).length <= 2;

  return hasCompanyFields && !looksLikeCheckpoint;
};

async function getBillingClassProfiles() {
  const rows = await SystemSetting.findAll({
    where: {
      key: {
        [Op.notIn]: Array.from(BILLING_CLASS_RESERVED_KEYS),
      },
    },
    raw: true,
  });

  return rows
    .filter((row) => isBillingClassProfileValue(row.value))
    .map((row) => normalizeBillingClassProfile(row.key, row.value))
    .sort((a, b) => a.tag.localeCompare(b.tag));
}

async function getBillingClassProfile(tag) {
  const normalizedTag = normalizeBillingClassTag(tag);
  if (!normalizedTag || BILLING_CLASS_RESERVED_KEYS.has(normalizedTag)) {
    return null;
  }

  const row = await SystemSetting.findOne({
    where: { key: normalizedTag },
    raw: true,
  });

  if (!row || !isBillingClassProfileValue(row.value)) {
    return null;
  }

  return normalizeBillingClassProfile(normalizedTag, row.value || {});
}

async function upsertBillingClassProfile(tag, nextProfile = {}, updatedBy) {
  const normalizedTag = normalizeBillingClassTag(tag);
  if (!normalizedTag) {
    throw new Error('Billing class tag is required');
  }
  if (BILLING_CLASS_RESERVED_KEYS.has(normalizedTag)) {
    throw new Error(`Unsupported billing class tag: ${tag}`);
  }

  const current = (await getBillingClassProfile(normalizedTag)) || normalizeBillingClassProfile(normalizedTag, {});
  const merged = normalizeBillingClassProfile(normalizedTag, {
    ...current,
    ...(nextProfile && typeof nextProfile === 'object' ? nextProfile : {}),
  });

  await SystemSetting.upsert({
    key: normalizedTag,
    value: merged,
    updatedBy: updatedBy || null,
  });

  return merged;
}

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
  getBillingClassProfiles,
  getBillingClassProfile,
  upsertBillingClassProfile,
};
