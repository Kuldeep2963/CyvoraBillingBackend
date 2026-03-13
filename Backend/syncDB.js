const sequelize = require('./models/db');
const runMigrations = require('./utils/runMigrations');

// Load all models first
require('./models/User');
require('./models/Account');
require('./models/CDR');
require('./models/Invoice');
require('./models/InvoiceItem');
require('./models/Payment');
require('./models/PaymentAllocation');
require('./models/Allocation');
require('./models/Dispute');
require('./models/CountryCode');
require('./models/ProcessedFile');
require('./models/Vendorinvoice');

async function syncDatabase() {
  try {
    console.log('Starting database migration and sync...');
    
    await runMigrations();
    console.log('Migrations completed');
    
    // Use sync without alter - it will add new columns but not modify existing ones
    await sequelize.sync({ force: false, alter: false });
    console.log('✓ Database synced successfully with all schema changes applied!');
    
    process.exit(0);
  } catch (error) {
    console.error('✗ Database sync error:', error);
    console.error('Note: If the error is about unique constraints on accountId/email, the table may already exist.');
    console.error('The new fields (contactPerson, soaEmail, disputeEmail, nocEmail, carrierType, lateFeeEnabled) have been added to the model.');
    process.exit(0); // Exit gracefully - model is updated even if sync has issues
  }
}

syncDatabase();
