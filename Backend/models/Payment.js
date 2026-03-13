const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Payment = sequelize.define('Payment', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  paymentNumber: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: 'Unique payment reference (e.g., PAY-2024-001)'
  },
  
  // Customer Info
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
    type: DataTypes.STRING(100),
    allowNull: true
  },
  
  // Payment Details
  amount: {
    type: DataTypes.DECIMAL(15, 4),
    allowNull: false
  },
  currency: {
    type: DataTypes.STRING(3),
    defaultValue: 'USD'
  },
  paymentDate: {
    type: DataTypes.BIGINT,
    allowNull: false,
    comment: 'Unix timestamp in milliseconds'
  },
  
  // Payment Method
  paymentMethod: {
    type: DataTypes.ENUM('bank_transfer','ustd', 'credit_card', 'debit_card', 'paypal', 'stripe', 'cash', 'cheque', 'other'),
    allowNull: false
  },
  paymentGateway: {
    type: DataTypes.STRING(100),
    comment: 'e.g., Stripe, PayPal, Razorpay'
  },
  
  // Transaction Details
  transactionId: {
    type: DataTypes.STRING(255),
    comment: 'External transaction ID from payment gateway'
  },
  referenceNumber: {
    type: DataTypes.STRING(255),
    comment: 'Bank reference or cheque number'
  },
  
  // Status
  status: {
    type: DataTypes.ENUM('pending', 'completed', 'failed', 'refunded', 'cancelled'),
    defaultValue: 'pending'
  },
  
  // Allocation to Invoices
  allocatedAmount: {
    type: DataTypes.DECIMAL(15, 4),
    defaultValue: 0,
    comment: 'Amount allocated to invoices'
  },
  unappliedAmount: {
    type: DataTypes.DECIMAL(15, 4),
    defaultValue: 0,
    comment: 'Remaining amount not yet applied to invoices'
  },
  
  // Notes
  notes: {
    type: DataTypes.TEXT
  },
  customerNotes: {
    type: DataTypes.TEXT
  },
  
  // Receipt
  receiptNumber: {
    type: DataTypes.STRING(50),
    unique: true
  },
  receiptPath: {
    type: DataTypes.STRING(500),
    comment: 'Path to generated receipt PDF'
  },
  
  // Metadata
  recordedBy: {
    type: DataTypes.INTEGER,
    comment: 'User ID who recorded the payment'
  },
  recordedDate: {
    type: DataTypes.BIGINT,
    comment: 'When payment was recorded in system'
  },
  
  // Refund Details
  refundedAmount: {
    type: DataTypes.DECIMAL(15, 4),
    defaultValue: 0
  },
  refundDate: {
    type: DataTypes.BIGINT
  },
  refundReason: {
    type: DataTypes.TEXT
  }
}, {
  tableName: 'payments',
  timestamps: true,
  indexes: [
    { fields: ['customerGatewayId'] },
    { fields: ['paymentNumber'], unique: true },
    { fields: ['status'] },
    { fields: ['paymentDate'] },
    { fields: ['transactionId'] }
  ]
});

module.exports = Payment;