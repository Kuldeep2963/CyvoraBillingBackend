'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      const table = await queryInterface.describeTable('payments', { transaction });

      // Remove index on status only when both index and column exist.
      if (table.status) {
        const indexes = await queryInterface.showIndex('payments', { transaction });
        const statusIndex = indexes.find((index) =>
          Array.isArray(index.fields) && index.fields.some((field) => field.attribute === 'status')
        );

        if (statusIndex) {
          await queryInterface.removeIndex('payments', statusIndex.name, { transaction });
        }
      }

      // Remove only columns that still exist to keep migration re-runnable.
      const removableColumns = [
        'status',
        'customerNotes',
        'receiptPath',
        'refundedAmount',
        'refundDate',
        'refundReason',
      ];

      for (const column of removableColumns) {
        if (table[column]) {
          await queryInterface.removeColumn('payments', column, { transaction });
        }
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
      // Restore removed fields
      await queryInterface.addColumn('payments', 'status', {
        type: Sequelize.ENUM('pending', 'completed', 'failed', 'refunded', 'cancelled'),
        defaultValue: 'pending',
        transaction
      });
      
      await queryInterface.addColumn('payments', 'customerNotes', {
        type: Sequelize.TEXT,
        transaction
      });
      
      await queryInterface.addColumn('payments', 'receiptPath', {
        type: Sequelize.STRING(500),
        comment: 'Path to generated receipt PDF',
        transaction
      });
      
      await queryInterface.addColumn('payments', 'refundedAmount', {
        type: Sequelize.DECIMAL(15, 4),
        defaultValue: 0,
        transaction
      });
      
      await queryInterface.addColumn('payments', 'refundDate', {
        type: Sequelize.BIGINT,
        transaction
      });
      
      await queryInterface.addColumn('payments', 'refundReason', {
        type: Sequelize.TEXT,
        transaction
      });
      
      // Restore status index
      await queryInterface.addIndex('payments', ['status'], { transaction });
      
      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }
};
