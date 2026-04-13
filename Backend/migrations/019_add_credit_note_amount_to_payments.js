'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDescription = await queryInterface.describeTable('payments');

    if (!tableDescription.creditNoteAmount) {
      await queryInterface.addColumn('payments', 'creditNoteAmount', {
        type: Sequelize.DECIMAL(15, 4),
        allowNull: false,
        defaultValue: 0,
      });
    }
  },

  async down(queryInterface) {
    const tableDescription = await queryInterface.describeTable('payments');

    if (tableDescription.creditNoteAmount) {
      await queryInterface.removeColumn('payments', 'creditNoteAmount');
    }
  },
};