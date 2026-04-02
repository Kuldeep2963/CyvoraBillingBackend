module.exports = {
  async up(queryInterface) {
    const allTables = await queryInterface.showAllTables();
    const normalizedTables = allTables.map((t) => {
      if (typeof t === 'string') return t.toLowerCase();
      if (t && typeof t.tableName === 'string') return t.tableName.toLowerCase();
      return '';
    });

    if (!normalizedTables.includes('system_settings')) {
      console.log('Skipping 005 migration: system_settings table does not exist yet');
      return;
    }

    const [rows] = await queryInterface.sequelize.query(
      `SELECT "key", "value" FROM system_settings WHERE "key" = 'global' LIMIT 1`
    );

    if (!Array.isArray(rows) || rows.length === 0) {
      console.log('Skipping 005 migration: no global system settings found');
      return;
    }

    const row = rows[0];
    const value = row && typeof row.value === 'object' && row.value !== null ? row.value : {};

    const normalized = {
      ...value,
      dataRetentionDays:
        value.dataRetentionDays !== undefined
          ? value.dataRetentionDays
          : value.dataretentiondays,
      notificationPollingSeconds:
        value.notificationPollingSeconds !== undefined
          ? value.notificationPollingSeconds
          : value.notificationpollingseconds,
    };

    // Remove legacy lowercase keys so only canonical keys remain.
    delete normalized.dataretentiondays;
    delete normalized.notificationpollingseconds;

    await queryInterface.bulkUpdate(
      'system_settings',
      { value: normalized },
      { key: 'global' }
    );

    console.log('005 migration applied: normalized legacy system setting keys');
  },

  async down(queryInterface) {
    const allTables = await queryInterface.showAllTables();
    const normalizedTables = allTables.map((t) => {
      if (typeof t === 'string') return t.toLowerCase();
      if (t && typeof t.tableName === 'string') return t.tableName.toLowerCase();
      return '';
    });

    if (!normalizedTables.includes('system_settings')) {
      return;
    }

    // No-op rollback: key normalization is intentionally forward-only.
  },
};
