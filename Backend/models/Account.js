const { DataTypes } = require('sequelize');
const sequelize = require('./db');

const Account = sequelize.define('Account', {
  // Primary Key & Account Identifiers
  accountId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    comment: 'Unique account ID for mapping with CDRs'
  },
  
  accountNumber: {
    type: DataTypes.STRING,
    unique: true,
    comment: 'Auto-generated account number'
  },
  
  // Account Role & Type (CRITICAL for CDR billing)
  accountRole: {
    type: DataTypes.ENUM('customer', 'vendor', 'both'),
    defaultValue: 'customer',
    allowNull: false,
    comment: 'Determines billing direction in CDR processing'
  },
  
  accountType: {
    type: DataTypes.ENUM('prepaid', 'postpaid', 'hybrid'),
    defaultValue: 'prepaid',
    comment: 'Payment model type'
  },
  
  accountStatus: {
    type: DataTypes.ENUM('active', 'inactive', 'suspended', 'pending'),
    defaultValue: 'active',
    allowNull: false
  },
  
  // CDR Mapping Fields (CRITICAL - maps to CDR records)
  customerCode: {
    type: DataTypes.STRING,
    index: true,
    comment: 'Maps to customeraccount field in CDRs'
  },
  
  vendorCode: {
    type: DataTypes.STRING,
    index: true,
    comment: 'Maps to agentaccount field in CDRs'
  },
  
  gatewayId: {
    type: DataTypes.STRING,
    comment: 'Gateway identifier for CDR routing'
  },
  
  productId: {
    type: DataTypes.STRING,
    comment: 'Product/service identifier for billing'
  },
  
  // Authentication Fields (NEW - from JSX)
  authenticationType: {
    type: DataTypes.ENUM('ip', 'custom'),
    defaultValue: 'ip',
    comment: 'Method to authenticate account in CDR matching'
  },
  
  authenticationValue: {
    type: DataTypes.STRING,
    comment: 'IP address, gateway ID, or custom field value for authentication'
  },
  
  // Basic Account Information
  accountName: {
    type: DataTypes.STRING,
    allowNull: false,
    index: true,
    comment: 'Company/Account name'
  },
  
  accountOwner: {
    type: DataTypes.STRING,
    comment: 'Account manager/sales rep'
  },
  
  ownership: {
    type: DataTypes.ENUM('None', 'private', 'public', 'subsidiary', 'others'),
    defaultValue: 'None'
  },
  
  // Contact Information
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  
  billingEmail: {
    type: DataTypes.STRING,
    validate: {
      isEmail: true
    }
  },
  
  phone: {
    type: DataTypes.STRING,
    allowNull: false,
    index: true
  },
  
  vendorFax: {
    type: DataTypes.STRING
  },
  
  // Account Status & Verification
  active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    index: true
  },
  
  vatNumber: {
    type: DataTypes.STRING,
    comment: 'VAT/Tax ID for invoicing'
  },
  
  verificationStatus: {
    type: DataTypes.ENUM('pending', 'verified', 'unverified'),
    defaultValue: 'pending'
  },
  
  // Reseller Information
  resellerAccount: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  
  reseller: {
    type: DataTypes.STRING,
    comment: 'Parent reseller name if applicable'
  },
  
  // Financial Settings (CRITICAL for billing)
  currency: {
    type: DataTypes.STRING(3),
    defaultValue: 'USD',
    allowNull: false
  },
  
  creditLimit: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 10000.00,
    comment: 'Maximum credit/prepaid balance allowed'
  },
  
  balance: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0.00,
    comment: 'Current account balance'
  },
  
  outstandingAmount: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0.00,
    comment: 'Unpaid invoices total'
  },
  
  nominalCode: {
    type: DataTypes.STRING,
    comment: 'GL/accounting code'
  },
  
  // Address Information
  addressLine1: {
    type: DataTypes.STRING,
    allowNull: false
  },
  
  addressLine2: {
    type: DataTypes.STRING
  },
  
  addressLine3: {
    type: DataTypes.STRING
  },
  
  city: {
    type: DataTypes.STRING,
    allowNull: false
  },
  
  state: {
    type: DataTypes.STRING
  },
  
  postalCode: {
    type: DataTypes.STRING,
    allowNull: false
  },
  
  country: {
    type: DataTypes.STRING(2),
    allowNull: false,
    defaultValue: 'US'
  },
  
  countryCode: {
    type: DataTypes.STRING(2),
    comment: 'ISO country code'
  },
  
  // Billing Configuration (CRITICAL)
  billingClass: {
    type: DataTypes.ENUM('paihk','paiusa'),
    defaultValue: ''
  },
  
  billingType: {
    type: DataTypes.ENUM('prepaid', 'postpaid'),
    defaultValue: 'prepaid'
  },
  
  billingTimezone: {
    type: DataTypes.STRING,
    defaultValue: 'UTC'
  },
  
  billingStartDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  
  billingCycle: {
    type: DataTypes.ENUM('daily', 'weekly', 'monthly', 'quarterly', 'annually'),
    defaultValue: 'monthly'
  },
  
  // Payment Settings
  autoPay: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  
  autoPayMethod: {
    type: DataTypes.ENUM('credit_card', 'bank_transfer', 'paypal', 'invoice'),
    defaultValue: 'credit_card'
  },
  
  sendInvoiceEmail: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  
  lateFeeEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  
  lateFeePercentage: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 5.00
  },
  
  gracePeriodDays: {
    type: DataTypes.INTEGER,
    defaultValue: 15
  },
  
  // Telecom-Specific Settings (CRITICAL for CDR platform)
  telecomProvider: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  
  wholesaleCustomer: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  
  retailCustomer: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  
  carrierType: {
    type: DataTypes.ENUM('tier1', 'tier2', 'tier3', 'mobile', 'voip', 'other'),
    defaultValue: 'tier2'
  },
  
  // Call Rating Settings (CRITICAL - used in CDR billing calculations)
  defaultRatePerSecond: {
    type: DataTypes.DECIMAL(10, 6),
    defaultValue: 0.010000,
    allowNull: false,
    comment: 'Customer rate per second'
  },
  
  taxRate: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 18.00,
    comment: 'Tax percentage applied to calls'
  },
  
  minimumCharge: {
    type: DataTypes.DECIMAL(10, 4),
    defaultValue: 0.0100,
    comment: 'Minimum charge per call'
  },
  
  roundingDecimal: {
    type: DataTypes.INTEGER,
    defaultValue: 4,
    comment: 'Decimal precision for billing amounts'
  },
  
  // Vendor Cost Settings (for vendor/both accounts)
  defaultCostPerSecond: {
    type: DataTypes.DECIMAL(10, 6),
    defaultValue: 0.008000,
    comment: 'Vendor cost per second (for margin calculation)'
  },
  
  marginPercentage: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 25.00,
    comment: 'Target profit margin percentage'
  },
  
  // CDR Processing Configuration (CRITICAL)
  cdrProcessingDelay: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Hours to delay CDR processing after call end'
  },
  
  billingDelay: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Days to delay billing after CDR generation'
  },
  
  // Localization
  timezone: {
    type: DataTypes.STRING,
    defaultValue: 'UTC'
  },
  
  languages: {
    type: DataTypes.STRING,
    defaultValue: 'en',
    comment: 'Preferred language code'
  },
  
  // Description
  description: {
    type: DataTypes.TEXT,
    comment: 'Account notes/description'
  },
  
  // Audit Fields
  createdBy: {
    type: DataTypes.STRING
  },
  
  updatedBy: {
    type: DataTypes.STRING
  }
}, {
  tableName: 'accounts',
  timestamps: true,
  indexes: [
    { unique: true, fields: ['accountId'] },
    { unique: true, fields: ['accountNumber'] },
    { unique: true, fields: ['email'] },
    { fields: ['accountName'] },
    { fields: ['phone'] },
    { fields: ['accountRole'] },
    { fields: ['accountStatus'] },
    { fields: ['customerCode'] },
    { fields: ['vendorCode'] },
    { fields: ['active'] },
    { fields: ['country'] },
    { fields: ['billingCycle'] },
    { fields: ['authenticationType'] }
  ]
});

// ============================================================================
// INSTANCE METHODS
// ============================================================================

/**
 * Get full formatted address
 */
Account.prototype.getFullAddress = function() {
  const parts = [
    this.addressLine1,
    this.addressLine2,
    this.addressLine3,
    this.city,
    this.state,
    this.postalCode,
    this.country
  ].filter(part => part && part.trim() !== '');
  
  return parts.join(', ');
};

/**
 * Calculate late fee based on account settings
 */
Account.prototype.calculateLateFee = function(amount, daysLate) {
  if (!this.lateFeeEnabled || daysLate <= this.gracePeriodDays) {
    return 0;
  }
  return (amount * this.lateFeePercentage) / 100;
};

/**
 * Get CDR mapping information for this account
 */
Account.prototype.getCDRMappingInfo = function() {
  const mapping = {
    accountId: this.accountId,
    accountRole: this.accountRole,
    authenticationType: this.authenticationType,
    authenticationValue: this.authenticationValue
  };
  
  if (this.accountRole === 'customer' || this.accountRole === 'both') {
    mapping.customerCode = this.customerCode;
  }
  
  if (this.accountRole === 'vendor' || this.accountRole === 'both') {
    mapping.vendorCode = this.vendorCode;
  }
  
  if (this.gatewayId) {
    mapping.gatewayId = this.gatewayId;
  }
  
  if (this.productId) {
    mapping.productId = this.productId;
  }
  
  return mapping;
};

/**
 * Calculate margin from cost and rate
 */
Account.prototype.calculateMargin = function() {
  if (this.defaultRatePerSecond <= 0) return 0;
  
  const margin = ((this.defaultRatePerSecond - this.defaultCostPerSecond) / this.defaultRatePerSecond) * 100;
  return parseFloat(margin.toFixed(2));
};

/**
 * Check if account can make calls (has sufficient balance for prepaid)
 */
Account.prototype.canMakeCalls = function() {
  if (this.accountStatus !== 'active' || !this.active) {
    return false;
  }
  
  if (this.billingType === 'prepaid' && this.balance <= 0) {
    return false;
  }
  
  if (this.billingType === 'postpaid' && this.balance < -this.creditLimit) {
    return false;
  }
  
  return true;
};

// ============================================================================
// HOOKS
// ============================================================================

Account.beforeCreate(async (account) => {
  // Generate accountId if not provided
  if (!account.accountId) {
    const random = Math.floor(10000 + Math.random() * 90000);
    account.accountId = `ACC-${random}`;
  }
  
  // Generate accountNumber if not provided
  if (!account.accountNumber) {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(10000 + Math.random() * 90000);
    account.accountNumber = `ACC-${dateStr}-${random}`;
  }
  
  // Auto-generate customer code for customer/both accounts
  if (!account.customerCode && (account.accountRole === 'customer' || account.accountRole === 'both')) {
    const random = Math.floor(10000 + Math.random() * 90000);
    account.customerCode = `C_${random}`;
  }
  
  // Auto-generate vendor code for vendor/both accounts
  if (!account.vendorCode && (account.accountRole === 'vendor' || account.accountRole === 'both')) {
    const random = Math.floor(10000 + Math.random() * 90000);
    account.vendorCode = `P_${random}`;
  }
  
  // Clear codes for non-applicable roles
  if (account.accountRole === 'customer') {
    account.vendorCode = null;
  } else if (account.accountRole === 'vendor') {
    account.customerCode = null;
  }
  
  // Set countryCode from country if not provided
  if (!account.countryCode && account.country) {
    account.countryCode = account.country;
  }
  
  // Sync active status with accountStatus
  if (account.accountStatus === 'active') {
    account.active = true;
  } else {
    account.active = false;
  }
});

Account.beforeUpdate((account) => {
  // Sync active status with accountStatus
  if (account.changed('accountStatus')) {
    if (account.accountStatus === 'active') {
      account.active = true;
    } else {
      account.active = false;
    }
  }
  
  // Clear vendor-specific fields if role changed to customer only
  if (account.changed('accountRole')) {
    if (account.accountRole === 'customer') {
      account.vendorCode = null;
      account.defaultCostPerSecond = null;
      account.marginPercentage = null;
    } else if (account.accountRole === 'vendor') {
      account.customerCode = null;
    }
  }
});

// ============================================================================
// CLASS METHODS
// ============================================================================

/**
 * Find account by CDR field matching
 */
Account.findByAuthentication = async function(authenticationType, authenticationValue) {
  return await Account.findOne({
    where: {
      authenticationType,
      authenticationValue,
      active: true,
      accountStatus: 'active'
    }
  });
};

/**
 * Find account by customer code
 */
Account.findByCustomerCode = async function(customerCode) {
  return await Account.findOne({
    where: {
      customerCode,
      accountRole: ['customer', 'both']
    }
  });
};

/**
 * Find account by vendor code
 */
Account.findByVendorCode = async function(vendorCode) {
  return await Account.findOne({
    where: {
      vendorCode,
      accountRole: ['vendor', 'both']
    }
  });
};

module.exports = Account;