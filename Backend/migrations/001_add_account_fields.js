module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      // Add new columns to accounts table
      const tableDescription = await queryInterface.describeTable('accounts');
      
      // Add contactPerson if it doesn't exist
      if (!tableDescription.contactPerson) {
        await queryInterface.addColumn('accounts', 'contactPerson', {
          type: Sequelize.STRING,
          allowNull: true,
          comment: 'Primary contact person name'
        });
        console.log('Added contactPerson column');
      }
      
      // Add contactPersonEmail if it doesn't exist
      if (!tableDescription.contactPersonEmail) {
        await queryInterface.addColumn('accounts', 'contactPersonEmail', {
          type: Sequelize.STRING,
          allowNull: true,
          validate: { isEmail: true },
          comment: 'Email of the primary contact person'
        });
        console.log('Added contactPersonEmail column');
      }
      
      // Add soaEmail if it doesn't exist
      if (!tableDescription.soaEmail) {
        await queryInterface.addColumn('accounts', 'soaEmail', {
          type: Sequelize.STRING,
          allowNull: true,
          validate: { isEmail: true },
          comment: 'Email for Statement of Account delivery'
        });
        console.log('Added soaEmail column');
      }
      
      // Add disputeEmail if it doesn't exist
      if (!tableDescription.disputeEmail) {
        await queryInterface.addColumn('accounts', 'disputeEmail', {
          type: Sequelize.STRING,
          allowNull: true,
          validate: { isEmail: true },
          comment: 'Email for dispute notifications'
        });
        console.log('Added disputeEmail column');
      }
      
      // Add nocEmail if it doesn't exist
      if (!tableDescription.nocEmail) {
        await queryInterface.addColumn('accounts', 'nocEmail', {
          type: Sequelize.STRING,
          allowNull: true,
          validate: { isEmail: true },
          comment: 'Email for Network Operations Center notifications'
        });
        console.log('Added nocEmail column');
      }
      
      // Add carrierType if it doesn't exist
      if (!tableDescription.carrierType) {
        await queryInterface.addColumn('accounts', 'carrierType', {
          type: Sequelize.ENUM('tier1', 'tier2', 'tier3', 'mobile', 'voip', 'other'),
          allowNull: true,
          comment: 'Type of carrier or provider'
        });
        console.log('Added carrierType column');
      }
      
      // Add lateFeeEnabled if it doesn't exist
      if (!tableDescription.lateFeeEnabled) {
        await queryInterface.addColumn('accounts', 'lateFeeEnabled', {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
          comment: 'Enable late fees for postpaid accounts'
        });
        console.log('Added lateFeeEnabled column');
      }
      
      console.log('Migration completed successfully');
    } catch (error) {
      console.error('Migration error:', error.message);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      const tableDescription = await queryInterface.describeTable('accounts');
      
      // Remove columns in reverse order if they exist
      if (tableDescription.lateFeeEnabled) {
        await queryInterface.removeColumn('accounts', 'lateFeeEnabled');
      }
      if (tableDescription.carrierType) {
        await queryInterface.removeColumn('accounts', 'carrierType');
      }
      if (tableDescription.nocEmail) {
        await queryInterface.removeColumn('accounts', 'nocEmail');
      }
      if (tableDescription.disputeEmail) {
        await queryInterface.removeColumn('accounts', 'disputeEmail');
      }
      if (tableDescription.soaEmail) {
        await queryInterface.removeColumn('accounts', 'soaEmail');
      }
      if (tableDescription.contactPersonEmail) {
        await queryInterface.removeColumn('accounts', 'contactPersonEmail');
      }
      if (tableDescription.contactPerson) {
        await queryInterface.removeColumn('accounts', 'contactPerson');
      }
      
      console.log('Rollback completed successfully');
    } catch (error) {
      console.error('Rollback error:', error.message);
      throw error;
    }
  }
};
