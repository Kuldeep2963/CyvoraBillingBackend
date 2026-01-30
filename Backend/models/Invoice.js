const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Invoice = sequelize.define('Invoice', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  invoiceNumber: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: 'Unique invoice number (e.g., INV-2024-001)'
  },
  customerGatewayId: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: 'Reference to Account.gatewayId'
  },
  customerName: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  customerCode: {
    type: DataTypes.STRING(100)
  },
  customerEmail: {
    type: DataTypes.STRING(255)
  },
  customerAddress: {
    type: DataTypes.TEXT
  },
  customerPhone: {
    type: DataTypes.STRING(50)
  },
  
  // Billing Period
  billingPeriodStart: {
    type: DataTypes.BIGINT,
    allowNull: false,
    comment: 'Unix timestamp in milliseconds'
  },
  billingPeriodEnd: {
    type: DataTypes.BIGINT,
    allowNull: false,
    comment: 'Unix timestamp in milliseconds'
  },
  
  // Invoice Dates
  invoiceDate: {
    type: DataTypes.BIGINT,
    allowNull: false,
    comment: 'Unix timestamp in milliseconds'
  },
  dueDate: {
    type: DataTypes.BIGINT,
    allowNull: false,
    comment: 'Unix timestamp in milliseconds'
  },
  
  // Financial Details
  subtotal: {
    type: DataTypes.DECIMAL(15, 4),
    allowNull: false,
    defaultValue: 0
  },
  taxRate: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 0,
    comment: 'Tax rate in percentage (e.g., 18 for 18%)'
  },
  taxAmount: {
    type: DataTypes.DECIMAL(15, 4),
    defaultValue: 0
  },
  discountAmount: {
    type: DataTypes.DECIMAL(15, 4),
    defaultValue: 0
  },
  adjustmentAmount: {
    type: DataTypes.DECIMAL(15, 4),
    defaultValue: 0,
    comment: 'Any manual adjustments (positive or negative)'
  },
  totalAmount: {
    type: DataTypes.DECIMAL(15, 4),
    allowNull: false,
    defaultValue: 0
  },
  paidAmount: {
    type: DataTypes.DECIMAL(15, 4),
    defaultValue: 0
  },
  balanceAmount: {
    type: DataTypes.DECIMAL(15, 4),
    defaultValue: 0
  },
  
  // Currency
  currency: {
    type: DataTypes.STRING(3),
    defaultValue: 'USD',
    comment: 'ISO 4217 currency code'
  },
  
  // Status
  status: {
    type: DataTypes.ENUM('draft', 'pending', 'sent', 'paid', 'partial', 'overdue', 'cancelled', 'void'),
    defaultValue: 'draft'
  },
  
  // Payment Details
  paymentMethod: {
    type: DataTypes.STRING(50),
    comment: 'e.g., Bank Transfer, Credit Card, PayPal'
  },
  paymentDate: {
    type: DataTypes.BIGINT,
    comment: 'Unix timestamp in milliseconds'
  },
  paymentReference: {
    type: DataTypes.STRING(255),
    comment: 'Transaction ID or reference number'
  },
  
  // Notes
  notes: {
    type: DataTypes.TEXT,
    comment: 'Internal notes'
  },
  customerNotes: {
    type: DataTypes.TEXT,
    comment: 'Notes visible to customer'
  },
  termsAndConditions: {
    type: DataTypes.TEXT
  },
  
  // Metadata
  generatedBy: {
    type: DataTypes.INTEGER,
    comment: 'User ID who generated the invoice'
  },
  sentDate: {
    type: DataTypes.BIGINT,
    comment: 'When invoice was sent to customer'
  },
  viewedDate: {
    type: DataTypes.BIGINT,
    comment: 'When customer first viewed the invoice'
  },
  
  // Auto-billing
  isRecurring: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  recurringPeriod: {
    type: DataTypes.ENUM('daily', 'weekly', 'monthly', 'quarterly', 'yearly'),
    comment: 'For recurring invoices'
  },
  
  // File attachments
  pdfPath: {
    type: DataTypes.STRING(500),
    comment: 'Path to generated PDF invoice'
  }
}, {
  tableName: 'invoices',
  timestamps: true,
  indexes: [
    { fields: ['customerId'] },
    { fields: ['invoiceNumber'], unique: true },
    { fields: ['status'] },
    { fields: ['billingPeriodStart', 'billingPeriodEnd'] },
    { fields: ['dueDate'] }
  ]
});

module.exports = Invoice;