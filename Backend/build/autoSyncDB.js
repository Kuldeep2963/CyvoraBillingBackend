const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const sequelize = require('./models/db');

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

function tableToString(tableName) {
  if (!tableName) return 'unknown_table';
  if (typeof tableName === 'string') return tableName;
  if (typeof tableName === 'object') {
    if (tableName.schema) {
      return `${tableName.schema}.${tableName.tableName}`;
    }
    return tableName.tableName || 'unknown_table';
  }
  return String(tableName);
}

function sanitizeAttributeForAddColumn(attribute) {
  const definition = {
    ...attribute,
  };

  // Remove sequelize-internal keys that QueryInterface.addColumn does not need.
  delete definition.Model;
  delete definition.fieldName;
  delete definition._modelAttribute;
  delete definition.field;
  delete definition.values;
  delete definition.referencesModel;
  delete definition.parent;
  delete definition.options;
  delete definition.typeOptions;

  // Avoid generating invalid Postgres SQL in ALTER TYPE statements.
  // Unique constraints are added separately through indexes/constraints.
  if (definition.unique === true) {
    delete definition.unique;
  }

  return definition;
}

async function applyMissingColumnsAndIndexes() {
  const queryInterface = sequelize.getQueryInterface();
  const models = sequelize.modelManager.models;

  let addedColumns = 0;
  let addedIndexes = 0;

  for (const model of models) {
    const tableName = model.getTableName();
    const tableLabel = tableToString(tableName);
    const attributes = model.rawAttributes;

    let tableDescription;
    try {
      tableDescription = await queryInterface.describeTable(tableName);
    } catch (error) {
      console.log(`[${tableLabel}] table missing, creating via sync`);
      await model.sync({ alter: false });
      tableDescription = await queryInterface.describeTable(tableName);
    }

    for (const [attrName, attribute] of Object.entries(attributes)) {
      const columnName = attribute.field || attrName;

      if (!tableDescription[columnName]) {
        const columnDefinition = sanitizeAttributeForAddColumn(attribute);
        await queryInterface.addColumn(tableName, columnName, columnDefinition);
        addedColumns += 1;
        console.log(`[${tableLabel}] added missing column: ${columnName}`);
      }
    }

    const modelIndexes = model.options.indexes || [];
    if (modelIndexes.length === 0) {
      continue;
    }

    const existingIndexes = await queryInterface.showIndex(tableName);
    const existingIndexNames = new Set(existingIndexes.map((index) => index.name));

    for (const indexDef of modelIndexes) {
      if (!indexDef || !indexDef.name) {
        continue;
      }

      if (existingIndexNames.has(indexDef.name)) {
        continue;
      }

      try {
        await queryInterface.addIndex(tableName, indexDef);
        addedIndexes += 1;
        console.log(`[${tableLabel}] added missing index: ${indexDef.name}`);
      } catch (error) {
        const msg = String(error && error.message ? error.message : error);
        if (msg.includes('already exists') || msg.includes('duplicate')) {
          console.log(`[${tableLabel}] index exists, skipped: ${indexDef.name}`);
        } else {
          throw error;
        }
      }
    }
  }

  console.log(`Additive sync summary: ${addedColumns} column(s), ${addedIndexes} index(es) added.`);
}

async function ensureInvoiceStatusEnumValues() {
  const requiredValues = [
    'draft',
    'generated',
    'pending',
    'sent',
    'partial',
    'paid',
    'overdue',
    'cancelled',
    'void',
  ];

  // If the enum type exists from an older schema, add missing values before sync.
  for (const value of requiredValues) {
    await sequelize.query(
      `DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_type t
          JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE t.typname = 'enum_invoices_status'
            AND n.nspname = 'public'
        ) THEN
          ALTER TYPE "public"."enum_invoices_status" ADD VALUE IF NOT EXISTS '${value}';
        END IF;
      END $$;`
    );
  }
}

async function autoSyncDatabase() {
  try {
    console.log('Starting AUTO database sync...');
    console.log(`Target DB: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);

    loadAllModels();

    await sequelize.authenticate();
    console.log('Database connection OK');

    await ensureInvoiceStatusEnumValues();
    console.log('Invoice status enum compatibility check completed');

    // Step 1: Ensure all tables exist.
    await sequelize.sync({ force: false, alter: false });
    console.log('Base table sync completed');

    // Step 2: Add any missing columns/indexes from model definitions.
    await applyMissingColumnsAndIndexes();

    console.log('SUCCESS Auto sync finished with latest additive schema updates.');
    process.exit(0);
  } catch (error) {
    console.error('ERROR Auto sync failed:', error);
    process.exit(1);
  }
}

autoSyncDatabase();
