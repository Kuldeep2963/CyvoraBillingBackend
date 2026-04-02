module.exports = {
  async up(queryInterface) {
    const allTables = await queryInterface.showAllTables();
    const normalizedTables = allTables.map((t) => {
      if (typeof t === 'string') return t.toLowerCase();
      if (t && typeof t.tableName === 'string') return t.tableName.toLowerCase();
      return '';
    });

    if (!normalizedTables.includes('cdrs')) {
      console.log('Skipping 007 migration: cdrs table does not exist yet');
      return;
    }

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS cdrs_starttime_bigint_idx
      ON cdrs (((starttime)::bigint))
      WHERE starttime ~ '^[0-9]+$'
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS cdrs_starttime_numeric_sort_idx
      ON cdrs (((starttime)::bigint) DESC)
      WHERE starttime ~ '^[0-9]+$'
    `);
  },

  async down(queryInterface) {
    const allTables = await queryInterface.showAllTables();
    const normalizedTables = allTables.map((t) => {
      if (typeof t === 'string') return t.toLowerCase();
      if (t && typeof t.tableName === 'string') return t.tableName.toLowerCase();
      return '';
    });

    if (!normalizedTables.includes('cdrs')) {
      return;
    }

    await queryInterface.sequelize.query('DROP INDEX IF EXISTS cdrs_starttime_numeric_sort_idx');
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS cdrs_starttime_bigint_idx');
  },
};
