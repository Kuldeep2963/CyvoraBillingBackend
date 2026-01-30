/**
 * Model Associations for Billing System
 * 
 * Import this file after all models are defined to set up relationships
 */

const Invoice = require('./Invoice');
const InvoiceItem = require('./InvoiceItem');
const Payment = require('./Payment');
const PaymentAllocation = require('./PaymentAllocation');
const Account = require('./Account');

// Invoice associations
Invoice.hasMany(InvoiceItem, {
  foreignKey: 'invoiceId',
  as: 'items',
  onDelete: 'CASCADE'
});

Invoice.belongsTo(Account, {
  foreignKey: 'customerGatewayId',
  targetKey: 'gatewayId',
  as: 'customer'
});

Invoice.hasMany(PaymentAllocation, {
  foreignKey: 'invoiceId',
  as: 'paymentAllocations'
});

// InvoiceItem associations
InvoiceItem.belongsTo(Invoice, {
  foreignKey: 'invoiceId',
  as: 'invoice'
});

// Payment associations
Payment.belongsTo(Account, {
  foreignKey: 'customerGatewayId',
  targetKey: 'gatewayId',
  as: 'customer'
});

Payment.hasMany(PaymentAllocation, {
  foreignKey: 'paymentId',
  as: 'allocations',
  onDelete: 'CASCADE'
});

// PaymentAllocation associations
PaymentAllocation.belongsTo(Payment, {
  foreignKey: 'paymentId',
  as: 'payment'
});

PaymentAllocation.belongsTo(Invoice, {
  foreignKey: 'invoiceId',
  as: 'invoice'
});

module.exports = {
  Invoice,
  InvoiceItem,
  Payment,
  PaymentAllocation
};