module.exports = {
  async up(queryInterface, Sequelize) {
    const allTables = await queryInterface.showAllTables();
    const normalizedTables = allTables.map((t) => {
      if (typeof t === 'string') return t.toLowerCase();
      if (t && typeof t.tableName === 'string') return t.tableName.toLowerCase();
      return '';
    });

    if (!normalizedTables.includes('accounts')) {
      console.log('Skipping 006 migration: accounts table does not exist yet');
      return;
    }

    const tableDescription = await queryInterface.describeTable('accounts');
    if (!tableDescription.documents) {
      await queryInterface.addColumn('accounts', 'documents', {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
      });
    }
  },

  async down(queryInterface) {
    const allTables = await queryInterface.showAllTables();
    const normalizedTables = allTables.map((t) => {
      if (typeof t === 'string') return t.toLowerCase();
      if (t && typeof t.tableName === 'string') return t.tableName.toLowerCase();
      return '';
    });

    if (!normalizedTables.includes('accounts')) {
      return;
    }

    const tableDescription = await queryInterface.describeTable('accounts');
    if (tableDescription.documents) {
      await queryInterface.removeColumn('accounts', 'documents');
    }
  },
};
