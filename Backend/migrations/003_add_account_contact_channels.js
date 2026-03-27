module.exports = {
  async up(queryInterface, Sequelize) {
    const allTables = await queryInterface.showAllTables();
    const normalizedTables = allTables.map((t) => {
      if (typeof t === 'string') return t.toLowerCase();
      if (t && typeof t.tableName === 'string') return t.tableName.toLowerCase();
      return '';
    });

    if (!normalizedTables.includes('accounts')) {
      console.log('Skipping 003 migration: accounts table does not exist yet');
      return;
    }

    const tableDescription = await queryInterface.describeTable('accounts');

    if (!tableDescription.contactPersonPhone) {
      await queryInterface.addColumn('accounts', 'contactPersonPhone', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }

    if (!tableDescription.ratesEmails) {
      await queryInterface.addColumn('accounts', 'ratesEmails', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }

    if (!tableDescription.ratesMobileNumber) {
      await queryInterface.addColumn('accounts', 'ratesMobileNumber', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }

    if (!tableDescription.billingEmails) {
      await queryInterface.addColumn('accounts', 'billingEmails', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }

    if (!tableDescription.billingPhoneNumbers) {
      await queryInterface.addColumn('accounts', 'billingPhoneNumbers', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }

    if (!tableDescription.disputeEmails) {
      await queryInterface.addColumn('accounts', 'disputeEmails', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }

    if (!tableDescription.disputePhoneNumber) {
      await queryInterface.addColumn('accounts', 'disputePhoneNumber', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }

    if (!tableDescription.nocEmails) {
      await queryInterface.addColumn('accounts', 'nocEmails', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }

    if (!tableDescription.nocPhoneNumbers) {
      await queryInterface.addColumn('accounts', 'nocPhoneNumbers', {
        type: Sequelize.STRING,
        allowNull: true,
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

    if (tableDescription.nocPhoneNumbers) {
      await queryInterface.removeColumn('accounts', 'nocPhoneNumbers');
    }

    if (tableDescription.nocEmails) {
      await queryInterface.removeColumn('accounts', 'nocEmails');
    }

    if (tableDescription.disputePhoneNumber) {
      await queryInterface.removeColumn('accounts', 'disputePhoneNumber');
    }

    if (tableDescription.disputeEmails) {
      await queryInterface.removeColumn('accounts', 'disputeEmails');
    }

    if (tableDescription.billingPhoneNumbers) {
      await queryInterface.removeColumn('accounts', 'billingPhoneNumbers');
    }

    if (tableDescription.billingEmails) {
      await queryInterface.removeColumn('accounts', 'billingEmails');
    }

    if (tableDescription.ratesMobileNumber) {
      await queryInterface.removeColumn('accounts', 'ratesMobileNumber');
    }

    if (tableDescription.ratesEmails) {
      await queryInterface.removeColumn('accounts', 'ratesEmails');
    }

    if (tableDescription.contactPersonPhone) {
      await queryInterface.removeColumn('accounts', 'contactPersonPhone');
    }
  },
};
