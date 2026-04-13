const { DataTypes } = require('sequelize');
const sequelize = require('./db');
const Account = require('./Account');

const VendorInvoice = sequelize.define('VendorInvoice', {
  vendorId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'accounts',
      key: 'id'
    }
  },
  vendorCode: {
    type: DataTypes.STRING,
    allowNull: false,
    index: true
  },
  invoiceNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  issueDate: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  startDate: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  endDate: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  grandTotal: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false
  },
  creditNoteAmount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0
  },
  currency: {
    type: DataTypes.STRING(3),
    defaultValue: 'USD',
    allowNull: false
  },
  totalSeconds: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  filePaths: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Stored as JSON array of file paths'
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected', 'processing', 'paid', 'processed', 'error'),
    defaultValue: 'pending'
  },
  isDisputed: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  }
}, {
  tableName: 'vendor_invoices',
  timestamps: true
});

VendorInvoice.belongsTo(Account, { foreignKey: 'vendorId', as: 'vendor' });

module.exports = VendorInvoice;
