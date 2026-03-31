const fs = require('fs');
const path = require('path');
const sequelize = require('../models/db');

const PROJECT_ROOT = path.join(__dirname, '..', '..');
const REPORT_PATH = path.join(__dirname, '..', 'reports', 'unused-columns-report.json');

const CODE_DIRS = [
  path.join(PROJECT_ROOT, 'Backend', 'api'),
  path.join(PROJECT_ROOT, 'Backend', 'config'),
  path.join(PROJECT_ROOT, 'Backend', 'controllers'),
  path.join(PROJECT_ROOT, 'Backend', 'middleware'),
  path.join(PROJECT_ROOT, 'Backend', 'models'),
  path.join(PROJECT_ROOT, 'Backend', 'routes'),
  path.join(PROJECT_ROOT, 'Backend', 'schedulers'),
  path.join(PROJECT_ROOT, 'Backend', 'services'),
  path.join(PROJECT_ROOT, 'Backend', 'templates'),
  path.join(PROJECT_ROOT, 'Backend', 'utils'),
  path.join(PROJECT_ROOT, 'frontend', 'src'),
];

const CODE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.json', '.sql', '.ejs']);

const ALWAYS_PROTECTED_COLUMNS = new Set([
  'id',
  'createdat',
  'updatedat',
  'deletedat',
  'created_at',
  'updated_at',
  'deleted_at',
]);

function toCamelCase(snake) {
  return snake.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function listFilesRecursively(dirPath) {
  if (!fs.existsSync(dirPath)) return [];

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const out = [];

  for (const entry of entries) {
    const abs = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      out.push(...listFilesRecursively(abs));
      continue;
    }

    const ext = path.extname(entry.name).toLowerCase();
    if (CODE_EXTENSIONS.has(ext)) {
      out.push(abs);
    }
  }

  return out;
}

function buildCodeCorpus() {
  const files = CODE_DIRS.flatMap((dirPath) => listFilesRecursively(dirPath));
  const chunks = [];

  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      chunks.push(content);
    } catch (_error) {
      // Ignore unreadable files.
    }
  }

  return chunks.join('\n');
}

async function fetchColumns() {
  return sequelize.query(
    `
    SELECT
      c.table_name,
      c.column_name,
      c.is_nullable,
      c.data_type,
      c.ordinal_position
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema
     AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
    ORDER BY c.table_name, c.ordinal_position;
    `,
    { type: sequelize.QueryTypes.SELECT }
  );
}

async function fetchProtectedColumns() {
  const rows = await sequelize.query(
    `
    WITH indexed_columns AS (
      SELECT
        n.nspname AS schema_name,
        t.relname AS table_name,
        a.attname AS column_name,
        i.indisprimary AS is_primary,
        i.indisunique AS is_unique,
        TRUE AS is_indexed
      FROM pg_index i
      JOIN pg_class t ON t.oid = i.indrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(i.indkey)
      WHERE n.nspname = 'public'
    ),
    fk_columns AS (
      SELECT
        tc.table_name,
        kcu.column_name,
        TRUE AS is_foreign_key
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
      WHERE tc.table_schema = 'public'
        AND tc.constraint_type = 'FOREIGN KEY'
    )
    SELECT
      COALESCE(i.table_name, f.table_name) AS table_name,
      COALESCE(i.column_name, f.column_name) AS column_name,
      COALESCE(i.is_primary, FALSE) AS is_primary,
      COALESCE(i.is_unique, FALSE) AS is_unique,
      COALESCE(i.is_indexed, FALSE) AS is_indexed,
      COALESCE(f.is_foreign_key, FALSE) AS is_foreign_key
    FROM indexed_columns i
    FULL OUTER JOIN fk_columns f
      ON i.table_name = f.table_name
     AND i.column_name = f.column_name;
    `,
    { type: sequelize.QueryTypes.SELECT }
  );

  const map = new Map();
  for (const row of rows) {
    const key = `${row.table_name}.${row.column_name}`;
    map.set(key, {
      isPrimary: Boolean(row.is_primary),
      isUnique: Boolean(row.is_unique),
      isIndexed: Boolean(row.is_indexed),
      isForeignKey: Boolean(row.is_foreign_key),
    });
  }

  return map;
}

function isColumnReferenced(corpus, columnName) {
  const variants = new Set([
    columnName,
    toCamelCase(columnName),
    `'${columnName}'`,
    `"${columnName}"`,
  ]);

  for (const variant of variants) {
    const escaped = escapeRegExp(variant);
    const regex = new RegExp(`(^|[^A-Za-z0-9_])${escaped}([^A-Za-z0-9_]|$)`, 'i');
    if (regex.test(corpus)) {
      return true;
    }
  }

  return false;
}

function ensureReportDir() {
  const dir = path.dirname(REPORT_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function main() {
  const apply = process.argv.includes('--apply');

  const corpus = buildCodeCorpus();
  const columns = await fetchColumns();
  const protectedMap = await fetchProtectedColumns();

  const analysis = [];
  const candidates = [];

  for (const column of columns) {
    const tableName = column.table_name;
    const columnName = column.column_name;
    const key = `${tableName}.${columnName}`;
    const protection = protectedMap.get(key) || {
      isPrimary: false,
      isUnique: false,
      isIndexed: false,
      isForeignKey: false,
    };

    const isAlwaysProtected = ALWAYS_PROTECTED_COLUMNS.has(columnName.toLowerCase());
    const isReferenced = isColumnReferenced(corpus, columnName);

    const reasons = [];
    if (isAlwaysProtected) reasons.push('always_protected');
    if (protection.isPrimary) reasons.push('primary_key');
    if (protection.isForeignKey) reasons.push('foreign_key');
    if (protection.isIndexed) reasons.push('indexed');
    if (protection.isUnique) reasons.push('unique');
    if (isReferenced) reasons.push('referenced_in_code');

    const shouldDrop = reasons.length === 0;

    const row = {
      table: tableName,
      column: columnName,
      dataType: column.data_type,
      nullable: column.is_nullable,
      reasons,
      action: shouldDrop ? 'drop' : 'keep',
    };

    analysis.push(row);
    if (shouldDrop) {
      candidates.push(row);
    }
  }

  ensureReportDir();
  fs.writeFileSync(REPORT_PATH, JSON.stringify({ generatedAt: new Date().toISOString(), apply, candidates, analysis }, null, 2));

  if (!apply) {
    console.log(`Dry run complete. ${candidates.length} removable columns found.`);
    console.log(`Report written to: ${REPORT_PATH}`);
    return;
  }

  if (candidates.length === 0) {
    console.log('No removable columns found.');
    console.log(`Report written to: ${REPORT_PATH}`);
    return;
  }

  const transaction = await sequelize.transaction();
  try {
    for (const candidate of candidates) {
      const query = `ALTER TABLE "${candidate.table}" DROP COLUMN IF EXISTS "${candidate.column}" CASCADE;`;
      await sequelize.query(query, { transaction });
      console.log(`Dropped ${candidate.table}.${candidate.column}`);
    }

    await transaction.commit();
    console.log(`Dropped ${candidates.length} columns.`);
    console.log(`Report written to: ${REPORT_PATH}`);
  } catch (error) {
    await transaction.rollback();
    console.error('Column removal failed. Transaction rolled back.');
    console.error(error?.message || error);
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error?.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await sequelize.close();
    } catch (_error) {
      // ignore close errors
    }
  });
