/**
 * Migration to add unique index on gatewayId in accounts table
 * 
 * This is required before creating the billing tables because
 * invoices and payments tables use gatewayId as a foreign key
 * 
 * Run this BEFORE the billing tables migration
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add unique index on gatewayId
    await queryInterface.addIndex('accounts', ['gatewayId'], {
      unique: true,
      name: 'idx_accounts_gateway_id_unique'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove the unique index
    await queryInterface.removeIndex('accounts', 'idx_accounts_gateway_id_unique');
  }
};