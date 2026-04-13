'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('vendor_invoices');

    if (!table.creditNoteAmount) {
      await queryInterface.addColumn('vendor_invoices', 'creditNoteAmount', {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('vendor_invoices');

    if (table.creditNoteAmount) {
      await queryInterface.removeColumn('vendor_invoices', 'creditNoteAmount');
    }
  },
};
