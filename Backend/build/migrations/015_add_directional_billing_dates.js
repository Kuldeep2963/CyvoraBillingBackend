'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      const tableDescription = await queryInterface.describeTable('accounts', { transaction });

      const columnsToAdd = [
        ['customerLastBillingDate', { type: Sequelize.DATEONLY, allowNull: true }],
        ['customerNextBillingDate', { type: Sequelize.DATEONLY, allowNull: true }],
        ['vendorLastBillingDate', { type: Sequelize.DATEONLY, allowNull: true }],
        ['vendorNextBillingDate', { type: Sequelize.DATEONLY, allowNull: true }],
      ];

      for (const [columnName, definition] of columnsToAdd) {
        if (!tableDescription[columnName]) {
          await queryInterface.addColumn('accounts', columnName, definition, { transaction });
        }
      }

      const rows = await queryInterface.sequelize.query(
        'SELECT id, "accountRole", lastbillingdate, nextbillingdate FROM accounts',
        { transaction, type: Sequelize.QueryTypes.SELECT }
      );

      for (const account of rows) {
        const updates = {};
        const role = String(account.accountRole || '').toLowerCase();

        if (account.lastbillingdate && !account.customerLastBillingDate) {
          updates.customerLastBillingDate = account.lastbillingdate;
        }
        if (account.nextbillingdate && !account.customerNextBillingDate) {
          updates.customerNextBillingDate = account.nextbillingdate;
        }
        if (role === 'vendor' || role === 'both') {
          if (account.lastbillingdate && !account.vendorLastBillingDate) {
            updates.vendorLastBillingDate = account.lastbillingdate;
          }
          if (account.nextbillingdate && !account.vendorNextBillingDate) {
            updates.vendorNextBillingDate = account.nextbillingdate;
          }
        }

        if (Object.keys(updates).length > 0) {
          await queryInterface.bulkUpdate('accounts', updates, { id: account.id }, { transaction });
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

      const columnsToRemove = [
        'vendorNextBillingDate',
        'vendorLastBillingDate',
        'customerNextBillingDate',
        'customerLastBillingDate',
      ];

      for (const columnName of columnsToRemove) {
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
};
