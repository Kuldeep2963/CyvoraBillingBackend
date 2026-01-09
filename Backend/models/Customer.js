const { DataTypes } = require('sequelize');
const sequelize = require('./db');

const Customer = sequelize.define('Customer', {
  // Account Owner & Basic Information
  accountOwner: {
    type: DataTypes.STRING,
    comment: 'Person responsible for the account'
  },
  ownership: {
    type: DataTypes.STRING,
    defaultValue: 'None',
    comment: 'Ownership type'
  },
  firstName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  lastName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  accountNumber: {
    type: DataTypes.STRING,
    unique: true,
    comment: 'Auto-generated account number'
  },
  accountName: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '*Required account name'
  },
  
  // Contact Information
  phone: {
    type: DataTypes.STRING,
    allowNull: false
  },
  vendorFax: {
    type: DataTypes.STRING,
    comment: 'Vendor fax number'
  },
  customerEmployee: {
    type: DataTypes.STRING,
    comment: 'Primary contact employee'
  },
  resellerAccount: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  reseller: {
    type: DataTypes.STRING,
    comment: 'Reseller name if applicable'
  },
  
  // Email Information
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
    },
    comment: 'Email for billing notifications'
  },
  
  // Account Status
  active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  vatNumber: {
    type: DataTypes.STRING,
    comment: 'VAT/Tax identification number'
  },
  verificationStatus: {
    type: DataTypes.STRING,
    defaultValue: 'pending',
    comment: 'Account verification status'
  },
  
  // Financial Information
  currency: {
    type: DataTypes.STRING,
    defaultValue: 'USD',
    allowNull: false
  },
  nominalCode: {
    type: DataTypes.STRING,
    comment: 'Accounting nominal code'
  },
  creditLimit: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 10000.00,
    comment: 'Maximum credit allowed'
  },
  balance: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0.00,
    comment: 'Current account balance'
  },
  outstandingAmount: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0.00,
    comment: 'Amount currently owed'
  },
  
  // Localization
  timezone: {
    type: DataTypes.STRING,
    defaultValue: 'UTC',
    comment: 'Customer timezone'
  },
  languages: {
    type: DataTypes.STRING,
    defaultValue: 'en',
    comment: 'Preferred languages'
  },
  
  // Description
  description: {
    type: DataTypes.TEXT,
    comment: 'Account description'
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
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'US'
  },
  
  // Billing Information
  billingClass: {
    type: DataTypes.STRING,
    defaultValue: 'standard',
    comment: 'Billing class/category'
  },
  billingType: {
    type: DataTypes.STRING,
    defaultValue: 'prepaid',
    comment: 'Prepaid/Postpaid billing'
  },
  billingTimezone: {
    type: DataTypes.STRING,
    defaultValue: 'UTC'
  },
  billingStartDate: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  billingCycle: {
    type: DataTypes.STRING,
    defaultValue: 'monthly',
    comment: 'Billing frequency'
  },
  nextInvoiceDate: {
    type: DataTypes.DATE,
    comment: 'Next scheduled invoice date'
  },
  nextChargeDate: {
    type: DataTypes.DATE,
    comment: 'Next scheduled charge date'
  },
  
  // Payment Settings
  autoPay: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Auto-pay enabled'
  },
  autoPayMethod: {
    type: DataTypes.STRING,
    defaultValue: 'credit_card',
    comment: 'Auto-pay method'
  },
  sendInvoiceEmail: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'Send invoice via email'
  },
  lateFeeEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'Late fee enabled'
  },
  lateFeePercentage: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 5.00,
    comment: 'Late fee percentage'
  },
  gracePeriodDays: {
    type: DataTypes.INTEGER,
    defaultValue: 15,
    comment: 'Grace period for payments'
  },
  
  // Telecom Specific
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
  
  // Call Rating Information
  defaultRatePerSecond: {
    type: DataTypes.DECIMAL(10, 4),
    defaultValue: 0.0100,
    comment: 'Default rate per second for calls'
  },
  taxRate: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 18.00,
    comment: 'Tax rate percentage'
  },
  minimumCharge: {
    type: DataTypes.DECIMAL(10, 4),
    defaultValue: 0.0100,
    comment: 'Minimum charge per call'
  },
  roundingDecimal: {
    type: DataTypes.INTEGER,
    defaultValue: 4,
    comment: 'Decimal places for rounding'
  },
  
  // Metadata
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  createdBy: {
    type: DataTypes.STRING
  },
  updatedBy: {
    type: DataTypes.STRING
  }
}, {
  tableName: 'customers',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['accountNumber']
    },
    {
      unique: true,
      fields: ['email']
    },
    {
      fields: ['accountName']
    },
    {
      fields: ['phone']
    },
    {
      fields: ['active']
    },
    {
      fields: ['country']
    }
  ]
});

// Instance methods
Customer.prototype.getFullName = function() {
  return `${this.firstName} ${this.lastName}`;
};

Customer.prototype.getFullAddress = function() {
  const addressParts = [
    this.addressLine1,
    this.addressLine2,
    this.addressLine3,
    this.city,
    this.state,
    this.postalCode,
    this.country
  ].filter(part => part && part.trim() !== '');
  
  return addressParts.join(', ');
};

Customer.prototype.getBillingAddress = function() {
  return this.getFullAddress(); // Can be customized if billing address is different
};

Customer.prototype.calculateLateFee = function(amount, daysLate) {
  if (!this.lateFeeEnabled || daysLate <= this.gracePeriodDays) {
    return 0;
  }
  return (amount * this.lateFeePercentage) / 100;
};

// Hooks
Customer.beforeCreate(async (customer) => {
  if (!customer.accountNumber) {
    // Generate account number: ACC-YYYYMMDD-XXXXX
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(10000 + Math.random() * 90000);
    customer.accountNumber = `ACC-${dateStr}-${random}`;
  }
  
  // Set next invoice date based on billing cycle
  if (!customer.nextInvoiceDate) {
    const startDate = new Date(customer.billingStartDate);
    let nextDate = new Date(startDate);
    
    switch (customer.billingCycle) {
      case 'daily':
        nextDate.setDate(startDate.getDate() + 1);
        break;
      case 'weekly':
        nextDate.setDate(startDate.getDate() + 7);
        break;
      case 'monthly':
        nextDate.setMonth(startDate.getMonth() + 1);
        break;
      case 'quarterly':
        nextDate.setMonth(startDate.getMonth() + 3);
        break;
      case 'annually':
        nextDate.setFullYear(startDate.getFullYear() + 1);
        break;
      default:
        nextDate.setMonth(startDate.getMonth() + 1);
    }
    
    customer.nextInvoiceDate = nextDate;
  }
  
  // Set next charge date (7 days after invoice date by default)
  if (!customer.nextChargeDate && customer.nextInvoiceDate) {
    const chargeDate = new Date(customer.nextInvoiceDate);
    chargeDate.setDate(chargeDate.getDate() + 7);
    customer.nextChargeDate = chargeDate;
  }
});

Customer.beforeUpdate((customer) => {
  customer.updatedAt = new Date();
});

module.exports = Customer;