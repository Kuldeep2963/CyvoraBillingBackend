'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(
      'ALTER TABLE accounts ADD COLUMN IF NOT EXISTS trunks JSONB DEFAULT \'[]\'::jsonb'
    );
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(
      'ALTER TABLE accounts DROP COLUMN IF EXISTS trunks'
    );
  },
};
