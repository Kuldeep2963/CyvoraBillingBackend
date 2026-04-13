module.exports = {
  up: async (queryInterface, Sequelize) => {
    const vendorTable = await queryInterface.describeTable('vendor_invoices');

    if (!vendorTable.isDisputed) {
      await queryInterface.addColumn('vendor_invoices', 'isDisputed', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }

    try {
      await queryInterface.dropTable('disputes');
    } catch (error) {
      // Keep migration idempotent when table is already removed.
      const msg = String(error?.message || '').toLowerCase();
      if (!msg.includes('does not exist') && !msg.includes('unknown table')) {
        throw error;
      }
    }
  },

  down: async (queryInterface, Sequelize) => {
    const vendorTable = await queryInterface.describeTable('vendor_invoices');

    if (vendorTable.isDisputed) {
      await queryInterface.removeColumn('vendor_invoices', 'isDisputed');
    }

    const allTables = await queryInterface.showAllTables();
    const normalized = allTables.map((t) => (typeof t === 'string' ? t : t.tableName || t.table_name)).filter(Boolean);

    if (!normalized.includes('disputes')) {
      await queryInterface.createTable('disputes', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        customerCode: {
          type: Sequelize.STRING(100),
          allowNull: false,
        },
        invoiceNumber: {
          type: Sequelize.TEXT,
          allowNull: false,
        },
        invoiceIds: {
          type: Sequelize.JSON,
          allowNull: true,
          defaultValue: [],
        },
        disputeAmount: {
          type: Sequelize.DECIMAL(15, 4),
          allowNull: false,
          defaultValue: 0,
        },
        customerName: {
          type: Sequelize.STRING(255),
          allowNull: false,
        },
        comment: {
          type: Sequelize.TEXT,
          allowNull: false,
        },
        mismatchedCount: {
          type: Sequelize.INTEGER,
          defaultValue: 0,
        },
        status: {
          type: Sequelize.ENUM('open', 'in_review', 'resolved', 'closed'),
          defaultValue: 'open',
        },
        resolvedAt: {
          type: Sequelize.BIGINT,
          allowNull: true,
        },
        resolvedBy: {
          type: Sequelize.INTEGER,
          allowNull: true,
        },
        comments: {
          type: Sequelize.JSON,
          allowNull: true,
          defaultValue: [],
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

      await queryInterface.addIndex('disputes', ['customerCode']);
      await queryInterface.addIndex('disputes', ['invoiceNumber']);
      await queryInterface.addIndex('disputes', ['status']);
      await queryInterface.addIndex('disputes', ['createdAt']);
    }
  },
};
