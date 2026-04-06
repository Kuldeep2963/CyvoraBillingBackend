'use strict';

module.exports = {
  up: async (queryInterface) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      const tableDescription = await queryInterface.describeTable('accounts', { transaction });

      const columnsToDrop = [
        'ratesMobileNumber',
        'billingPhoneNumbers',
        'disputePhoneNumber',
        'nocPhoneNumbers',
        'carrierType',
      ];

      for (const columnName of columnsToDrop) {
        if (tableDescription[columnName]) {
          await queryInterface.removeColumn('accounts', columnName, { transaction });
        }
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
      const tableDescription = await queryInterface.describeTable('accounts', { transaction });

      if (!tableDescription.ratesMobileNumber) {
        await queryInterface.addColumn('accounts', 'ratesMobileNumber', {
          type: Sequelize.JSONB,
          allowNull: false,
          defaultValue: [],
        }, { transaction });
      }

      if (!tableDescription.billingPhoneNumbers) {
        await queryInterface.addColumn('accounts', 'billingPhoneNumbers', {
          type: Sequelize.JSONB,
          allowNull: false,
          defaultValue: [],
        }, { transaction });
      }

      if (!tableDescription.disputePhoneNumber) {
        await queryInterface.addColumn('accounts', 'disputePhoneNumber', {
          type: Sequelize.JSONB,
          allowNull: false,
          defaultValue: [],
        }, { transaction });
      }

      if (!tableDescription.nocPhoneNumbers) {
        await queryInterface.addColumn('accounts', 'nocPhoneNumbers', {
          type: Sequelize.JSONB,
          allowNull: false,
          defaultValue: [],
        }, { transaction });
      }

      if (!tableDescription.carrierType) {
        await queryInterface.addColumn('accounts', 'carrierType', {
          type: Sequelize.ENUM('tier1', 'tier2', 'tier3', 'mobile', 'voip', 'other'),
          allowNull: true,
        }, { transaction });
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
