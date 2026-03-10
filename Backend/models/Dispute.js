const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Dispute = sequelize.define('Dispute', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  customerCode: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: 'Reference to Account.customerCode'
  },
  invoiceNumber: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: 'Comma or semicolon-separated list of mismatched invoice number pairs'
  },
  invoiceIds: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
    comment: 'JSON array of mismatched invoice IDs'
  },
  disputeAmount: {
    type: DataTypes.DECIMAL(15, 4),
    allowNull: false,
    defaultValue: 0
  },
  customerName: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  comment: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  mismatchedCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  status: {
    type: DataTypes.ENUM('open', 'in_review', 'resolved', 'closed'),
    defaultValue: 'open'
  },
  resolvedAt: {
    type: DataTypes.BIGINT,
    comment: 'Unix timestamp in milliseconds when dispute was resolved'
  },
  resolvedBy: {
    type: DataTypes.INTEGER,
    comment: 'User ID who resolved the dispute'
  }
}, {
  tableName: 'disputes',
  timestamps: true,
  indexes: [
    { fields: ['customerCode'] },
    { fields: ['invoiceNumber'] },
    { fields: ['status'] },
    { fields: ['createdAt'] }
  ]
});

module.exports = Dispute;
