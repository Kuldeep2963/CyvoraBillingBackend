'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // Remove index on status field before dropping it
      await queryInterface.removeIndex('payments', ['status'], { transaction });
      
      // Remove unused fields
      await queryInterface.removeColumn('payments', 'status', { transaction });
      await queryInterface.removeColumn('payments', 'customerNotes', { transaction });
      await queryInterface.removeColumn('payments', 'receiptPath', { transaction });
      await queryInterface.removeColumn('payments', 'refundedAmount', { transaction });
      await queryInterface.removeColumn('payments', 'refundDate', { transaction });
      await queryInterface.removeColumn('payments', 'refundReason', { transaction });
      
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
