module.exports = {
  async up(queryInterface, Sequelize) {
    const allTables = await queryInterface.showAllTables();
    const normalizedTables = allTables.map((t) => {
      if (typeof t === 'string') return t.toLowerCase();
      if (t && typeof t.tableName === 'string') return t.tableName.toLowerCase();
      return '';
    });

    if (!normalizedTables.includes('notifications')) {
      console.log('Skipping 009 migration: notifications table does not exist yet');
      return;
    }

    const table = await queryInterface.describeTable('notifications');
    if (table.audience_role) {
      console.log('Skipping 009 migration: audience_role already exists');
      return;
    }

    await queryInterface.addColumn('notifications', 'audience_role', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    const allTables = await queryInterface.showAllTables();
    const normalizedTables = allTables.map((t) => {
      if (typeof t === 'string') return t.toLowerCase();
      if (t && typeof t.tableName === 'string') return t.tableName.toLowerCase();
      return '';
    });

    if (!normalizedTables.includes('notifications')) {
      return;
    }

    const table = await queryInterface.describeTable('notifications');
    if (!table.audience_role) {
      return;
    }

    await queryInterface.removeColumn('notifications', 'audience_role');
  },
};