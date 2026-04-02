module.exports = {
  async up(queryInterface) {
    const allTables = await queryInterface.showAllTables();
    const normalizedTables = allTables.map((t) => {
      if (typeof t === 'string') return t.toLowerCase();
      if (t && typeof t.tableName === 'string') return t.tableName.toLowerCase();
      return '';
    });

    if (!normalizedTables.includes('accounts')) {
      console.log('Skipping 004 migration: accounts table does not exist yet');
      return;
    }

    const ensureJsonbArrayColumn = async (columnName) => {
      const tableDescription = await queryInterface.describeTable('accounts');
      const column = tableDescription[columnName];
      if (!column) return;

      const typeText = String(column.type || '').toUpperCase();
      if (typeText.includes('JSONB')) return;

      await queryInterface.sequelize.query(`
        ALTER TABLE accounts
        ALTER COLUMN "${columnName}" TYPE JSONB
        USING (
          CASE
            WHEN "${columnName}" IS NULL THEN '[]'::jsonb
            WHEN btrim("${columnName}"::text, '"') = '' THEN '[]'::jsonb
            ELSE to_jsonb(array_remove(regexp_split_to_array(btrim("${columnName}"::text, '"'), E'\\s*,\\s*'), ''))
          END
        )
      `);
    };

    await ensureJsonbArrayColumn('ratesEmails');
    await ensureJsonbArrayColumn('ratesMobileNumber');
    await ensureJsonbArrayColumn('billingEmails');
    await ensureJsonbArrayColumn('billingPhoneNumbers');
    await ensureJsonbArrayColumn('disputeEmails');
    await ensureJsonbArrayColumn('disputePhoneNumber');
    await ensureJsonbArrayColumn('nocEmails');
    await ensureJsonbArrayColumn('nocPhoneNumbers');
  },

  async down(queryInterface, Sequelize) {
    const allTables = await queryInterface.showAllTables();
    const normalizedTables = allTables.map((t) => {
      if (typeof t === 'string') return t.toLowerCase();
      if (t && typeof t.tableName === 'string') return t.tableName.toLowerCase();
      return '';
    });

    if (!normalizedTables.includes('accounts')) {
      return;
    }

    const ensureStringColumn = async (columnName, typeSql) => {
      const tableDescription = await queryInterface.describeTable('accounts');
      const column = tableDescription[columnName];
      if (!column) return;

      const typeText = String(column.type || '').toUpperCase();
      if (!typeText.includes('JSONB')) return;

      await queryInterface.sequelize.query(`
        ALTER TABLE accounts
        ALTER COLUMN "${columnName}" TYPE ${typeSql}
        USING (
          CASE
            WHEN jsonb_typeof("${columnName}") = 'array'
              THEN array_to_string(ARRAY(SELECT jsonb_array_elements_text("${columnName}")), ', ')
            ELSE COALESCE("${columnName}"::text, '')
          END
        )
      `);
    };

    await ensureStringColumn('ratesEmails', 'TEXT');
    await ensureStringColumn('ratesMobileNumber', 'VARCHAR(255)');
    await ensureStringColumn('billingEmails', 'TEXT');
    await ensureStringColumn('billingPhoneNumbers', 'VARCHAR(255)');
    await ensureStringColumn('disputeEmails', 'TEXT');
    await ensureStringColumn('disputePhoneNumber', 'VARCHAR(255)');
    await ensureStringColumn('nocEmails', 'TEXT');
    await ensureStringColumn('nocPhoneNumbers', 'VARCHAR(255)');
  },
};
