const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const InvoiceItem = sequelize.define('InvoiceItem', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  invoiceId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'Reference to Invoice table'
  },
  
  // Item Details
  itemType: {
    type: DataTypes.ENUM('call_charges', 'destination_charge', 'monthly_fee', 'setup_fee', 'additional_service', 'discount', 'adjustment'),
    allowNull: false
  },
  description: {
    type: DataTypes.STRING(500),
    allowNull: false
  },
  
  // Destination Info (for call charges)
  destination: {
    type: DataTypes.STRING(255),
    comment: 'Country or destination name'
  },
  destinationCode: {
    type: DataTypes.STRING(50),
    comment: 'Country code or prefix'
  },
  trunk: {
    type: DataTypes.STRING(100),
    comment: 'Trunk name (NCLI, CLI, etc.)'
  },
  prefix: {
    type: DataTypes.INTEGER(50),
    comment: 'Call prefix'
  },
  
  // Quantity and Duration
  quantity: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    comment: 'Number of calls or units'
  },
  duration: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Total duration in seconds'
  },
  
  
  // Pricing
  unitPrice: {
    type: DataTypes.DECIMAL(15, 6),
    allowNull: false,
    comment: 'Price per unit/minute'
  },
  amount: {
    type: DataTypes.DECIMAL(15, 4),
    allowNull: false,
    comment: 'Total amount (quantity * unitPrice)'
  },
  
  // Call Statistics (for call_charges type)
  totalCalls: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  completedCalls: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  failedCalls: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  asr: {
    type: DataTypes.DECIMAL(5, 2),
    comment: 'Answer Seizure Ratio in percentage'
  },
  acd: {
    type: DataTypes.DECIMAL(10, 2),
    comment: 'Average Call Duration in seconds'
  },
  
  // Tax
  taxable: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  taxAmount: {
    type: DataTypes.DECIMAL(15, 4),
    defaultValue: 0
  },
  
  // Metadata
  periodStart: {
    type: DataTypes.BIGINT,
    comment: 'For this specific item period'
  },
  periodEnd: {
    type: DataTypes.BIGINT
  },
  
  // Sorting
  sortOrder: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }
}, {
  tableName: 'invoice_items',
  timestamps: true,
  indexes: [
    { fields: ['invoiceId'] },
    { fields: ['itemType'] },
    { fields: ['destination'] }
  ]
});

module.exports = InvoiceItem;