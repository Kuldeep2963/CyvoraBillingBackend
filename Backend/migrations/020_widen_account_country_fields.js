'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      const tableDescription = await queryInterface.describeTable('accounts', { transaction });

      if (tableDescription.country) {
        await queryInterface.changeColumn(
          'accounts',
          'country',
          {
            type: Sequelize.STRING(10),
            allowNull: false,
            defaultValue: 'US',
          },
          { transaction }
        );
      }

      if (tableDescription.countryCode) {
        await queryInterface.changeColumn(
          'accounts',
          'countryCode',
          {
            type: Sequelize.STRING(10),
            allowNull: true,
            comment: 'Country code or calling code',
          },
          { transaction }
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
      const tableDescription = await queryInterface.describeTable('accounts', { transaction });

      if (tableDescription.country) {
        await queryInterface.changeColumn(
          'accounts',
          'country',
          {
            type: Sequelize.STRING(2),
            allowNull: false,
            defaultValue: 'US',
          },
          { transaction }
        );
      }

      if (tableDescription.countryCode) {
        await queryInterface.changeColumn(
          'accounts',
          'countryCode',
          {
            type: Sequelize.STRING(2),
            allowNull: true,
            comment: 'ISO country code',
          },
          { transaction }
        );
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};