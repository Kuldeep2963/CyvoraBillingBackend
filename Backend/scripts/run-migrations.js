const runMigrations = require('../utils/runMigrations');
const sequelize = require('../models/db');

async function main() {
  try {
    await runMigrations();
    console.log('Migration command completed');
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('Migration command failed:', error);
    try {
      await sequelize.close();
    } catch (_) {
      // Ignore close errors on failure path
    }
    process.exit(1);
  }
}

main();
