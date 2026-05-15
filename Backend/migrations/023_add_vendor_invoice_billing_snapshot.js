'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      const tableDescription = await queryInterface.describeTable('vendor_invoices', { transaction });

      if (!tableDescription.billingStateSnapshot) {
        await queryInterface.addColumn(
          'vendor_invoices',
          'billingStateSnapshot',
          {
            type: Sequelize.JSONB,
            allowNull: true,
            defaultValue: null,
          },
          { transaction },
        );
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      const tableDescription = await queryInterface.describeTable('vendor_invoices', { transaction });

      if (tableDescription.billingStateSnapshot) {
        await queryInterface.removeColumn('vendor_invoices', 'billingStateSnapshot', { transaction });
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};