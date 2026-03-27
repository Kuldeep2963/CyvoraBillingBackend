module.exports = {
  async up(queryInterface) {
    const allTables = await queryInterface.showAllTables();
    const normalizedTables = allTables.map((t) => {
      if (typeof t === 'string') return t.toLowerCase();
      if (t && typeof t.tableName === 'string') return t.tableName.toLowerCase();
      return '';
    });

    if (!normalizedTables.includes('processed_files')) {
      console.log('Skipping 008 migration: processed_files table does not exist');
      return;
    }

    await queryInterface.dropTable('processed_files');
  },

  async down(queryInterface, Sequelize) {
    const allTables = await queryInterface.showAllTables();
    const normalizedTables = allTables.map((t) => {
      if (typeof t === 'string') return t.toLowerCase();
      if (t && typeof t.tableName === 'string') return t.tableName.toLowerCase();
      return '';
    });

    if (normalizedTables.includes('processed_files')) {
      return;
    }

    await queryInterface.createTable('processed_files', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      filename: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      status: {
        type: Sequelize.STRING,
        defaultValue: 'PROCESSING',
      },
      started_at: {
        type: Sequelize.DATE,
      },
      completed_at: {
        type: Sequelize.DATE,
      },
      records_processed: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },
      error_message: {
        type: Sequelize.TEXT,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    });
  },
};