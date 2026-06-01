"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      // If the table exists, describeTable will succeed
      await queryInterface.describeTable('disputes');
      await queryInterface.dropTable('disputes');
      console.log('Dropped table: disputes');
    } catch (err) {
      // Table doesn't exist or cannot be described - skip
      console.log('Skipping drop of disputes table (not present)');
    }
  },

  down: async (queryInterface, Sequelize) => {
    const { DataTypes } = Sequelize;
    // Recreate the disputes table matching the previous model shape
    await queryInterface.createTable('disputes', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      customerCode: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: 'Reference to Account.customerCode',
      },
      invoiceNumber: {
        type: DataTypes.TEXT,
        allowNull: false,
        comment: 'Comma or semicolon-separated list of mismatched invoice number pairs',
      },
      invoiceIds: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: [],
        comment: 'JSON array of mismatched invoice IDs',
      },
      disputeAmount: {
        type: DataTypes.DECIMAL(15, 4),
        allowNull: false,
        defaultValue: 0,
      },
      customerName: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      comment: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      mismatchedCount: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
      },
      status: {
        type: DataTypes.ENUM('open', 'in_review', 'resolved', 'closed'),
        allowNull: false,
        defaultValue: 'open',
      },
      resolvedAt: {
        type: DataTypes.BIGINT,
        allowNull: true,
        comment: 'Unix timestamp in milliseconds when dispute was resolved',
      },
      resolvedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'User ID who resolved the dispute',
      },
      comments: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: [],
        comment: 'Array of comment objects with {text, timestamp, userId, userName}',
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // Recreate indexes similar to the model
    await queryInterface.addIndex('disputes', ['customerCode']);
    await queryInterface.addIndex('disputes', ['invoiceNumber']);
    await queryInterface.addIndex('disputes', ['status']);
    await queryInterface.addIndex('disputes', ['createdAt']);
  },
};
