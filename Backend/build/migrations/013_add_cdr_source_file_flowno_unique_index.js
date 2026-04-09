'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      const tables = await queryInterface.showAllTables({ transaction });
      const normalizedTables = tables.map((table) =>
        typeof table === 'string' ? table : table.tableName
      );

      if (!normalizedTables.includes('cdrs')) {
        console.log('Skipping 013 migration: cdrs table does not exist yet');
        await transaction.commit();
        return;
      }

      const indexes = await queryInterface.showIndex('cdrs', { transaction });
      const indexExists = indexes.some((index) =>
        index.name === 'cdrs_source_file_flowno_unique'
      );

      if (!indexExists) {
        await queryInterface.addIndex('cdrs', ['source_file', 'flowno'], {
          name: 'cdrs_source_file_flowno_unique',
          unique: true,
          transaction,
        });
      }

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      const tables = await queryInterface.showAllTables({ transaction });
      const normalizedTables = tables.map((table) =>
        typeof table === 'string' ? table : table.tableName
      );

      if (!normalizedTables.includes('cdrs')) {
        await transaction.commit();
        return;
      }

      const indexes = await queryInterface.showIndex('cdrs', { transaction });
      const indexExists = indexes.some((index) =>
        index.name === 'cdrs_source_file_flowno_unique'
      );

      if (indexExists) {
        await queryInterface.removeIndex('cdrs', 'cdrs_source_file_flowno_unique', { transaction });
      }

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }
};