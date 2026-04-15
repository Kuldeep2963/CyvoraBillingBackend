module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      let tableName = 'Users';
      let tableDescription;

      try {
        tableDescription = await queryInterface.describeTable('Users', { transaction });
      } catch (_err) {
        tableName = 'users';
        tableDescription = await queryInterface.describeTable('users', { transaction });
      }

      if (!tableDescription.tokenVersion) {
        await queryInterface.addColumn(
          tableName,
          'tokenVersion',
          {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0,
            comment: 'Increment to revoke issued JWTs',
          },
          { transaction }
        );
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      try {
        const tableDescription = await queryInterface.describeTable('Users', { transaction });
        if (tableDescription.tokenVersion) {
          await queryInterface.removeColumn('Users', 'tokenVersion', { transaction });
        }
      } catch (_err) {
        const tableDescription = await queryInterface.describeTable('users', { transaction });
        if (tableDescription.tokenVersion) {
          await queryInterface.removeColumn('users', 'tokenVersion', { transaction });
        }
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};