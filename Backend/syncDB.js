const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const sequelize = require('./models/db');
const runMigrations = require('./utils/runMigrations');

function loadAllModels() {
  const modelsDir = path.join(__dirname, 'models');
  const modelFiles = fs
    .readdirSync(modelsDir)
    .filter((file) => file.endsWith('.js'))
    .filter((file) => !['db.js', 'index.js'].includes(file));

  for (const file of modelFiles) {
    require(path.join(modelsDir, file));
  }

  console.log(`Loaded ${modelFiles.length} model files`);
}

async function syncDatabase() {
  try {
    const applyAlter = process.env.DB_SYNC_ALTER !== 'false';

    console.log('Starting database migration and sync...');
    console.log(`Target DB: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
    console.log(`Schema alter mode: ${applyAlter ? 'enabled' : 'disabled'} (set DB_SYNC_ALTER=false to disable)`);

    loadAllModels();
    await sequelize.authenticate();
    console.log('Database connection OK');
    
    await runMigrations();
    console.log('Migrations completed');
    
    // Apply model-level schema changes to existing tables when alter mode is enabled.
    await sequelize.sync({ force: false, alter: applyAlter });
    console.log('✓ Database synced successfully with all schema changes applied!');
    
    process.exit(0);
  } catch (error) {
    console.error('✗ Database sync error:', error);
    process.exit(1);
  }
}

syncDatabase();
