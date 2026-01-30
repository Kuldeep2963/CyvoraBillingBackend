'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // ====================================================================
      // 1. ADD NEW FIELDS
      // ====================================================================
      
      // Add authenticationType field
      await queryInterface.addColumn('accounts', 'authenticationType', {
        type: Sequelize.ENUM('ip', 'custom'),
        defaultValue: 'ip',
        comment: 'Method to authenticate account in CDR matching'
      }, { transaction });
      
      // Add authenticationValue field
      await queryInterface.addColumn('accounts', 'authenticationValue', {
        type: Sequelize.STRING,
        comment: 'IP address, gateway ID, or custom field value for authentication'
      }, { transaction });
      
      
      
      
      // ====================================================================
      // 3. REMOVE UNUSED FIELDS
      // ====================================================================
      
      // Remove nextInvoiceDate (can be calculated on-demand)
      await queryInterface.removeColumn('accounts', 'nextInvoiceDate', { transaction });
      
      // Remove nextChargeDate (can be calculated on-demand)
      await queryInterface.removeColumn('accounts', 'nextChargeDate', { transaction });
      
      // ====================================================================
      // 4. ADD NEW INDEXES
      // ====================================================================
      
      // Index for authenticationType (for faster CDR lookups)
      await queryInterface.addIndex('accounts', ['authenticationType'], {
        name: 'idx_accounts_authentication_type',
        transaction
      });
      
      // Index for authenticationValue (for faster CDR matching)
      await queryInterface.addIndex('accounts', ['authenticationValue'], {
        name: 'idx_accounts_authentication_value',
        transaction
      });
      
      // Composite index for active CDR lookups
      await queryInterface.addIndex('accounts', ['active', 'accountStatus'], {
        name: 'idx_accounts_active_status',
        transaction
      });
      
      // Index for billingCycle (for batch billing jobs)
      await queryInterface.addIndex('accounts', ['billingCycle'], {
        name: 'idx_accounts_billing_cycle',
        transaction
      });
      
      await transaction.commit();
      console.log('✅ Migration completed successfully');
      
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Migration failed:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // ====================================================================
      // REVERSE: Remove indexes
      // ====================================================================
      await queryInterface.removeIndex('accounts', 'idx_accounts_billing_cycle', { transaction });
      await queryInterface.removeIndex('accounts', 'idx_accounts_active_status', { transaction });
      await queryInterface.removeIndex('accounts', 'idx_accounts_authentication_value', { transaction });
      await queryInterface.removeIndex('accounts', 'idx_accounts_authentication_type', { transaction });
      
      // ====================================================================
      // REVERSE: Add back removed columns
      // ====================================================================
      await queryInterface.addColumn('accounts', 'nextInvoiceDate', {
        type: Sequelize.DATE,
        comment: 'Next scheduled invoice date'
      }, { transaction });
      
      await queryInterface.addColumn('accounts', 'nextChargeDate', {
        type: Sequelize.DATE,
        comment: 'Next scheduled charge date'
      }, { transaction });
      
      // ====================================================================
      // REVERSE: Revert field modifications
      // ====================================================================
      await queryInterface.changeColumn('accounts', 'defaultRatePerSecond', {
        type: Sequelize.DECIMAL(10, 6),
        defaultValue: 0.010000,
        allowNull: true
      }, { transaction });
      
      await queryInterface.changeColumn('accounts', 'billingStartDate', {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }, { transaction });
      
      await queryInterface.changeColumn('accounts', 'autoPayMethod', {
        type: Sequelize.STRING,
        defaultValue: 'credit_card'
      }, { transaction });
      
      await queryInterface.changeColumn('accounts', 'billingCycle', {
        type: Sequelize.STRING,
        defaultValue: 'monthly'
      }, { transaction });
      
      await queryInterface.changeColumn('accounts', 'billingType', {
        type: Sequelize.STRING,
        defaultValue: 'prepaid'
      }, { transaction });
      
      await queryInterface.changeColumn('accounts', 'billingClass', {
        type: Sequelize.STRING,
        defaultValue: 'standard'
      }, { transaction });
      
      await queryInterface.changeColumn('accounts', 'verificationStatus', {
        type: Sequelize.STRING,
        defaultValue: 'pending'
      }, { transaction });
      
      await queryInterface.changeColumn('accounts', 'ownership', {
        type: Sequelize.STRING,
        defaultValue: 'None'
      }, { transaction });
      
      await queryInterface.changeColumn('accounts', 'accountStatus', {
        type: Sequelize.ENUM('active', 'inactive'),
        defaultValue: 'active'
      }, { transaction });
      
      // ====================================================================
      // REVERSE: Remove new columns
      // ====================================================================
      await queryInterface.removeColumn('accounts', 'accountType', { transaction });
      await queryInterface.removeColumn('accounts', 'authenticationValue', { transaction });
      await queryInterface.removeColumn('accounts', 'authenticationType', { transaction });
      
      await transaction.commit();
      console.log('✅ Rollback completed successfully');
      
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Rollback failed:', error);
      throw error;
    }
  }
};