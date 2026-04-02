const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PaymentAllocation = sequelize.define('PaymentAllocation', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  paymentId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'Reference to Payment table'
  },
  invoiceId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'Reference to Invoice table'
  },
  allocatedAmount: {
    type: DataTypes.DECIMAL(15, 4),
    allowNull: false,
    comment: 'Amount allocated from payment to this invoice'
  },
  allocationDate: {
    type: DataTypes.BIGINT,
    allowNull: false,
    comment: 'Unix timestamp in milliseconds'
  },
  notes: {
    type: DataTypes.TEXT
  },
  allocatedBy: {
    type: DataTypes.INTEGER,
    comment: 'User ID who made the allocation'
  }
}, {
  tableName: 'payment_allocations',
  timestamps: true,
  indexes: [
    { fields: ['paymentId'] },
    { fields: ['invoiceId'] },
    { fields: ['paymentId', 'invoiceId'], unique: true }
  ]
});

module.exports = PaymentAllocation;