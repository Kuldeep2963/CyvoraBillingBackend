const fs = require('fs');
const path = require('path');
const sequelize = require('../models/db');

/**
 * Manually run all migration files in the migrations folder
 */
async function runMigrations() {
  try {
    const migrationsDir = path.join(__dirname, '../migrations');
    
    // Skip if migrations folder doesn't exist (migrations have been consolidated into autoSyncDB)
    if (!fs.existsSync(migrationsDir)) {
      return;
    }

    const migrationFiles = fs.readdirSync(migrationsDir).sort();

    if (migrationFiles.length === 0) {
      return;
    }

    console.log(`Found ${migrationFiles.length} migration files`);

    for (const file of migrationFiles) {
      if (file.endsWith('.js')) {
        console.log(`Running migration: ${file}`);
        const migration = require(path.join(migrationsDir, file));
        
        try {
          await migration.up(sequelize.getQueryInterface(), sequelize.Sequelize);
          console.log(`✓ Migration completed: ${file}`);
        } catch (err) {
          // Migration might have already been run, check if it's a "already exists" error
          if (err.message && err.message.includes('already exists')) {
            console.log(`⊕ Migration skipped (already applied): ${file}`);
          } else {
            console.error(`✗ Migration failed: ${file}`, err.message);
            // Don't throw - continue with next migration
          }
        }
      }
    }

  } catch (error) {
    console.error('Error running migrations:', error);
    // Don't throw - allow app to continue
  }
}

module.exports = runMigrations;
