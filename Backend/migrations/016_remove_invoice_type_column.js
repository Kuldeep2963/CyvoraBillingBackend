const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Remove invoiceType column from invoices table
    // This migration limits invoices to customer invoices only
    await queryInterface.removeColumn('invoices', 'invoiceType');
  },

  down: async (queryInterface, Sequelize) => {
    // Restore invoiceType column with ENUM type
    await queryInterface.addColumn('invoices', 'invoiceType', {
      type: Sequelize.ENUM('customer', 'vendor'),
      defaultValue: 'customer',
      allowNull: false,
    });
  }
};
