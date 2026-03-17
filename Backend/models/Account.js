const { DataTypes } = require('sequelize');
const sequelize = require('./db');
const User = require('./User');

const Account = sequelize.define('Account', {
  // Primary Key & Account Identifiers
  accountId: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Unique account ID for mapping with CDRs'
  },
  
  // Account Role & Type (CRITICAL for CDR billing)
  accountRole: {
    type: DataTypes.ENUM('customer', 'vendor', 'both'),
    defaultValue: 'customer',
    allowNull: false,
    comment: 'Determines billing direction in CDR processing'
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
  
  
  
  // Authentication Fields (NEW - from JSX)
  customerauthenticationType: {
    type: DataTypes.ENUM('ip', 'custom'),
    defaultValue: 'ip',
    comment: 'Method to authenticate account in CDR matching'
  },
  
  customerauthenticationValue: {
    type: DataTypes.STRING,
    comment: 'IP address, gateway ID, or custom field value for authentication'
  },

  vendorauthenticationType: {
    type: DataTypes.ENUM('ip', 'custom'),
    defaultValue: 'ip',
    comment: 'Method to authenticate account in CDR matching'
  },
  
  vendorauthenticationValue: {
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
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'User ID of the account owner (references Users.id)'
  },
  
  contactPerson: {
    type: DataTypes.STRING,
    comment: 'Primary contact person name'
  },
  
  contactPersonEmail: {
    type: DataTypes.STRING,
    validate: {
      isEmail: true
    },
    comment: 'Email of the primary contact person'
  },
  
  // Contact Information
  email: {
    type: DataTypes.STRING,
    allowNull: false,
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
  
  soaEmail: {
    type: DataTypes.STRING,
    validate: {
      isEmail: true
    },
    comment: 'Email for Statement of Account delivery'
  },
  
  disputeEmail: {
    type: DataTypes.STRING,
    validate: {
      isEmail: true
    },
    comment: 'Email for dispute notifications'
  },
  
  nocEmail: {
    type: DataTypes.STRING,
    validate: {
      isEmail: true
    },
    comment: 'Email for Network Operations Center notifications'
  },
  
  phone: {
    type: DataTypes.STRING,
    allowNull: false,
    index: true
  },
  
  vendorFax: {
    type: DataTypes.STRING
  },
  
  // Carrier Information
  carrierType: {
    type: DataTypes.ENUM('tier1', 'tier2', 'tier3', 'mobile', 'voip', 'other'),
    comment: 'Type of carrier or provider'
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

  originalCreditLimit: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 10000.00,
    comment: 'Original credit limit to reset to when invoice is paid (for postpaid accounts)'
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
    type: DataTypes.ENUM('paihk', 'paiusa'),
    defaultValue: 'paiusa',
    allowNull: true
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

  lastbillingdate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    comment: 'Date of the last billing process'
  },

  nextbillingdate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    comment: 'Date of the next scheduled billing process'
  },
  
  // Payment Settings
  sendInvoiceEmail: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  
  lateFeeEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Enable late fees for postpaid accounts'
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
    { fields: ['customerauthenticationType'] },
    { fields: ['vendorauthenticationType'] }
  ]
});

// ============================================================================
// INSTANCE METHODS
// ============================================================================

/**
 * Get full formatted address
 */
// ============================================================================
// ASSOCIATIONS
// ============================================================================
Account.belongsTo(User, {
  foreignKey: 'accountOwner',
  as: 'owner'
});

// For backward compatibility with any code expecting the associate method
Account.associate = function(models) {
  Account.belongsTo(models.User, {
    foreignKey: 'accountOwner',
    as: 'owner'
  });
};

Account.prototype.getFullAddress = function() {
  const parts = [
    this.addressLine1,
    this.addressLine2,
    this.addressLine3,
    this.city,
    this.state,
    this.postalCode,
    this.country
  ].filter(part => part && part.trim().length > 0);
  
  return parts.join(', ');
};

module.exports = Account;
