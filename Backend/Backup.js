#!/usr/bin/env node
'use strict';

/**
 * CDR Historical Backfill Script
 * ════════════════════════════════════════════════════════════════════════════
 * Run this ONCE (or whenever you need to re-import history) to fetch all
 * e_cdr_YYYYMMDD tables from the remote MySQL server and insert any missing
 * CDRs into your local database.
 *
 * Usage:
 *   node backfill-cdr.js                          # all tables found on server
 *   node backfill-cdr.js --from 20260101          # from a specific date
 *   node backfill-cdr.js --from 20260101 --to 20260331  # date range
 *   node backfill-cdr.js --dry-run                # count rows, don't insert
 *   node backfill-cdr.js --reset-checkpoints      # delete checkpoints and restart
 *   node backfill-cdr.js --ignore-checkpoints     # start from 0 but keep checkpoints
 *
 * Options:
 *   --from  YYYYMMDD   Start date (inclusive). Defaults to earliest table found.
 *   --to    YYYYMMDD   End date   (inclusive). Defaults to today (UTC).
 *   --dry-run          Fetch and count rows but do NOT insert into the DB.
 *   --reset-checkpoints  DELETE saved checkpoints so all tables restart from flowno=0.
 *                        Use when you want to fully re-import and clean up SystemSetting.
 *   --ignore-checkpoints Start every table from flowno=0 WITHOUT deleting checkpoints.
 *                        USE THIS when the live poller ran before backfill and advanced
 *                        checkpoints past rows that were never actually inserted.
 *                        Deduplication ensures no double-inserts.
 *   --concurrency N    How many tables to process in parallel (default: 1).
 *                      Keep at 1 unless your source DB can handle the load.
 *
 * The script is safe to interrupt and re-run — it uses the same checkpoint
 * system as the live poller, so it always resumes from where it left off.
 * ════════════════════════════════════════════════════════════════════════════
 */

// ─── Bootstrap (same as your app entry point) ─────────────────────────────────
// Adjust the path below if your app bootstrap (dotenv, Sequelize init) is elsewhere.
require('dotenv').config();

// Lazy-require your app's DB connection so Sequelize is initialized before
// we touch any models. Adjust the path to wherever your sequelize instance is.
const sequelize = require('./config/database');   // Backend/config/database.js

const mysql   = require('mysql2/promise');
const net     = require('net');
const { spawn } = require('child_process');

// We re-use the shared insert logic from the live service.
// The destructured export was added at the bottom of mysql-cdr-fetcher.js.
const { fetchAndInsertTable } = require('./services/cdr-auto-fetch');

// ─── Arg parsing ──────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    from:               null,    // YYYYMMDD string or null
    to:                 null,    // YYYYMMDD string or null
    dryRun:             false,
    resetCheckpoints:   false,
    ignoreCheckpoints:  false,   // start from flowno=0 without deleting checkpoints
    concurrency:        1,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--from':               opts.from               = args[++i]; break;
      case '--to':                 opts.to                 = args[++i]; break;
      case '--dry-run':            opts.dryRun             = true;      break;
      case '--reset-checkpoints':  opts.resetCheckpoints   = true;      break;
      case '--ignore-checkpoints': opts.ignoreCheckpoints  = true;      break;
      case '--concurrency':        opts.concurrency        = Number(args[++i]) || 1; break;
      default:
        console.warn(`[backfill] Unknown arg: ${args[i]}`);
    }
  }
  return opts;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isEmptyEnv(value) {
  if (value === undefined || value === null) return true;
  return String(value).trim() === '';
}

function firstNonEmptyValue(...values) {
  for (const v of values) if (!isEmptyEnv(v)) return v;
  return undefined;
}

function ymd(dateStr) {
  // 'YYYYMMDD' → Date (UTC midnight)
  const y = Number(dateStr.slice(0, 4));
  const m = Number(dateStr.slice(4, 6)) - 1;
  const d = Number(dateStr.slice(6, 8));
  return new Date(Date.UTC(y, m, d));
}

function dateToTableSuffix(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function todayUtcSuffix() {
  return dateToTableSuffix(new Date());
}

function parseCheckpointValue(value) {
  if (value === null || value === undefined) return 0n;
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return BigInt(Math.trunc(value));
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return 0n;

    try {
      return parseCheckpointValue(JSON.parse(trimmed));
    } catch {
      // Continue with manual normalization.
    }

    let normalized = trimmed;
    while (normalized.length >= 2) {
      const first = normalized[0];
      const last = normalized[normalized.length - 1];
      if ((first === '"' && last === '"') || (first === '\'' && last === '\'')) {
        normalized = normalized.slice(1, -1).trim();
      } else {
        break;
      }
    }

    if (/^-?\d+$/.test(normalized)) return BigInt(normalized);
    return 0n;
  }
  if (typeof value === 'object') {
    if (value.flowno != null) return parseCheckpointValue(value.flowno);
    if (value.value != null) return parseCheckpointValue(value.value);
  }
  return 0n;
}

/** Returns all e_cdr_YYYYMMDD table names from the remote DB. */
async function discoverTables(pool, database) {
  const [rows] = await pool.query(
    `SELECT TABLE_NAME
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ?
       AND TABLE_NAME REGEXP '^e_cdr_[0-9]{8}$'
     ORDER BY TABLE_NAME ASC`,
    [database]
  );
  return rows.map(r => r.TABLE_NAME);
}

/** Filter table list by optional --from / --to date range. */
function filterByDateRange(tables, from, to) {
  return tables.filter(name => {
    const suffix = name.replace('e_cdr_', '');
    if (from && suffix < from) return false;
    if (to   && suffix > to  ) return false;
    return true;
  });
}

/** Clears all checkpoints for the given sourceId from SystemSetting. */
async function resetCheckpoints(sourceId) {
  const SystemSetting = require('./models/SystemSetting');
  const { Op } = require('sequelize');
  const prefix = `mysql_cdr_last_flowno_${sourceId}_`;
  const deleted = await SystemSetting.destroy({
    where: { key: { [Op.like]: `${prefix}%` } },
  });
  console.log(`[backfill] Cleared ${deleted} checkpoint(s) for sourceId="${sourceId}"`);
}

/** Simple pool-based concurrency: run tasks CONCURRENCY at a time. */
async function runWithConcurrency(tasks, concurrency, worker) {
  const results = [];
  let   idx     = 0;

  const runNext = async () => {
    while (idx < tasks.length) {
      const task    = tasks[idx++];
      const result  = await worker(task);
      results.push(result);
    }
  };

  const workers = Array.from({ length: concurrency }, runNext);
  await Promise.all(workers);
  return results;
}

// ─── SSH Tunnel (mirrors live service) ────────────────────────────────────────

async function canConnectLocalPort(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    socket.once('connect', () => { socket.destroy(); resolve(true);  });
    socket.once('error',   () => { socket.destroy(); resolve(false); });
  });
}

async function startSshTunnel(config) {
  const portInUse = await canConnectLocalPort(config.tunnelLocalPort);
  if (portInUse) {
    console.log(`[backfill] Reusing existing SSH tunnel on localhost:${config.tunnelLocalPort}`);
    return null; // no process to track — already running externally
  }

  const args = [
    '-N',
    '-L', `${config.tunnelLocalPort}:${config.tunnelRemoteHost}:${config.tunnelRemotePort}`,
    '-i', config.sshKeyPath,
    '-p', String(config.sshPort),
    '-o', 'BatchMode=yes',
    '-o', 'ExitOnForwardFailure=yes',
    '-o', 'StrictHostKeyChecking=no',
    '-o', 'ServerAliveInterval=30',
    '-o', 'ServerAliveCountMax=3',
    `${config.sshUser}@${config.sshHost}`,
  ];

  const proc = spawn('ssh', args, { stdio: ['ignore', 'ignore', 'pipe'] });
  proc.stderr.on('data', chunk => {
    const msg = String(chunk).trim();
    if (msg) console.error(`[backfill] SSH tunnel: ${msg}`);
  });

  await new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const tryConnect = () => {
      const socket = net.createConnection({ host: '127.0.0.1', port: config.tunnelLocalPort });
      socket.once('connect', () => { socket.destroy(); resolve(); });
      socket.once('error',   () => {
        socket.destroy();
        if (Date.now() - startedAt > 25_000) {
          proc.kill('SIGTERM');
          reject(new Error(`SSH tunnel did not open port ${config.tunnelLocalPort} within 25s`));
          return;
        }
        setTimeout(tryConnect, 250);
      });
    };
    tryConnect();
  });

  console.log(`[backfill] SSH tunnel ready on localhost:${config.tunnelLocalPort}`);
  return proc;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs();

  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log(  '║          CDR Historical Backfill                 ║');
  console.log(  '╚══════════════════════════════════════════════════╝');
  if (opts.dryRun)            console.log('[backfill] ⚠️  DRY-RUN mode — no data will be written');
  if (opts.ignoreCheckpoints) console.log('[backfill] ⚠️  IGNORE-CHECKPOINTS mode — reading from flowno=0 for every table (deduplication active)');
  if (opts.resetCheckpoints)  console.log('[backfill] ⚠️  RESET-CHECKPOINTS mode — saved progress will be deleted');
  console.log('');

  // ── Build config (same env vars as live service) ───────────────────────────
  const hasSshEnv = Boolean(
    !isEmptyEnv(process.env.SERVER_IP) &&
    !isEmptyEnv(process.env.SSH_USERNAME) &&
    !isEmptyEnv(process.env.SSH_KEY_PATH)
  );
  const explicitTunnelFlag = process.env.MYSQL_CDR_USE_SSH_TUNNEL;
  const useSshTunnel = explicitTunnelFlag === undefined
    ? hasSshEnv
    : String(explicitTunnelFlag).toLowerCase() === 'true';

  const config = {
    host:             firstNonEmptyValue(process.env.MYSQL_CDR_HOST, process.env.SERVER_IP),
    port:             Number(firstNonEmptyValue(process.env.MYSQL_CDR_PORT, process.env.SERVER_DB_PORT, 3306)),
    user:             firstNonEmptyValue(process.env.MYSQL_CDR_USER, process.env.SERVER_DB_USER, process.env.SSH_USERNAME),
    password:         firstNonEmptyValue(process.env.MYSQL_CDR_PASSWORD, process.env.SERVER_DB_PASSWORD),
    database:         firstNonEmptyValue(process.env.MYSQL_CDR_DATABASE, process.env.SERVER_DB_NAME, 'vos3000'),
    sourceId:         firstNonEmptyValue(process.env.MYSQL_CDR_SOURCE_ID, process.env.SERVER_IP, 'mysql-source'),
    useSshTunnel,
    tunnelLocalPort:  Number(firstNonEmptyValue(process.env.MYSQL_CDR_TUNNEL_LOCAL_PORT, 13306)),
    tunnelRemotePort: Number(firstNonEmptyValue(process.env.MYSQL_CDR_REMOTE_PORT, process.env.MYSQL_CDR_PORT, 3306)),
    tunnelRemoteHost: firstNonEmptyValue(process.env.MYSQL_CDR_REMOTE_HOST, '127.0.0.1'),
    sshHost:          firstNonEmptyValue(process.env.SERVER_IP),
    sshUser:          firstNonEmptyValue(process.env.SSH_USERNAME),
    sshPort:          Number(firstNonEmptyValue(process.env.SSH_PORT, 22)),
    sshKeyPath:       firstNonEmptyValue(process.env.SSH_KEY_PATH),
  };

  // ── Connect Sequelize (loads all models) ──────────────────────────────────
  try {
    await sequelize.authenticate();
    console.log('[backfill] Local DB connected');
  } catch (err) {
    console.error('[backfill] Cannot connect to local DB:', err.message);
    process.exit(1);
  }

  // ── Optionally reset checkpoints ──────────────────────────────────────────
  if (opts.resetCheckpoints && !opts.dryRun) {
    await resetCheckpoints(config.sourceId);
  }

  // ── SSH tunnel ────────────────────────────────────────────────────────────
  let sshProc = null;
  if (useSshTunnel) {
    sshProc = await startSshTunnel(config);
  }

  // ── Create pool ───────────────────────────────────────────────────────────
  const pool = mysql.createPool({
    host:               useSshTunnel ? '127.0.0.1' : config.host,
    port:               useSshTunnel ? config.tunnelLocalPort : (config.port || 3306),
    user:               config.user,
    password:           config.password,
    database:           config.database,
    waitForConnections: true,
    connectionLimit:    Math.max(opts.concurrency + 1, 3),
    queueLimit:         20,
    connectTimeout:     10_000,
  });

  // Verify
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    console.log(`[backfill] Connected to source DB (${config.database})`);
  } catch (err) {
    console.error('[backfill] Cannot connect to source DB:', err.message);
    process.exit(1);
  }

  // ── Discover tables ───────────────────────────────────────────────────────
  console.log('[backfill] Discovering tables...');
  let tables = await discoverTables(pool, config.database);
  console.log(`[backfill] Found ${tables.length} e_cdr_* table(s) on source`);

  const fromDate = opts.from ?? null;
  const toDate   = opts.to   ?? todayUtcSuffix();
  tables = filterByDateRange(tables, fromDate, toDate);

  if (!tables.length) {
    console.log(`[backfill] No tables match the date range (${fromDate ?? 'earliest'} → ${toDate}). Exiting.`);
    process.exit(0);
  }

  console.log(`[backfill] Processing ${tables.length} table(s) (${tables[0]} → ${tables[tables.length - 1]})`);
  console.log(`[backfill] Concurrency: ${opts.concurrency}`);
  console.log('');

  // ── Process tables ────────────────────────────────────────────────────────
  const overallStart = Date.now();
  let   grandFetched = 0;
  let   grandInserted= 0;
  let   tablesDone   = 0;
  let   tablesSkipped= 0;

  await runWithConcurrency(tables, opts.concurrency, async (tableName) => {
    const SystemSetting = require('./models/SystemSetting');
    const CHECKPOINT_KEY = 'mysql_cdr_last_flowno';
    const key            = `${CHECKPOINT_KEY}_${config.sourceId}_${tableName}`;
    const existing       = await SystemSetting.findOne({ where: { key }, raw: true });

    // --ignore-checkpoints: always start from flowno=0.
    // This is the fix for when the live poller advanced a checkpoint past rows
    // that were never actually inserted into the local DB.
    // Deduplication (ignoreDuplicates + pre-check) ensures no double-inserts.
    let lastFlowno = 0n;
    if (!opts.ignoreCheckpoints && existing?.value != null) {
      lastFlowno = parseCheckpointValue(existing.value);
    }

    const checkpointNote = opts.ignoreCheckpoints
      ? `checkpoint ignored (was ${existing?.value ?? 'none'})`
      : `checkpoint=${lastFlowno}`;

    if (opts.dryRun) {
      // In dry-run mode: count all rows above the checkpoint.
      const [countRows] = await pool.query(
        `SELECT COUNT(*) AS cnt FROM \`${tableName}\`
         WHERE flowno > ?`,
        [lastFlowno.toString()]
      );
      const cnt = Number(countRows[0].cnt);
      console.log(`[backfill] ${tableName}: ${cnt} rows would be fetched (${checkpointNote})`);
      grandFetched += cnt;
      tablesDone++;
      return;
    }

    const tableStart = Date.now();
    const result = await fetchAndInsertTable(pool, config.sourceId, tableName, lastFlowno, {
      // When ignoring checkpoints we still want the fetcher to save the NEW
      // checkpoint at the end so the live poller resumes correctly afterward.
      updateCheckpoint: true,
      includeIncomplete: true,
    });

    if (!result) {
      console.log(`[backfill] ${tableName}: table not found — skipping`);
      tablesSkipped++;
      return;
    }

    const elapsed = ((Date.now() - tableStart) / 1000).toFixed(1);
    console.log(
      `[backfill] ${tableName}: fetched=${result.fetched} inserted=${result.inserted} ` +
      `maxFlowno=${result.maxFlowno} ${checkpointNote} (${elapsed}s)`
    );

    grandFetched  += result.fetched;
    grandInserted += result.inserted;
    tablesDone++;
  });

  // ── Summary ───────────────────────────────────────────────────────────────
  const totalSecs = ((Date.now() - overallStart) / 1000).toFixed(1);
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log(  '║                 Backfill Complete                ║');
  console.log(  '╚══════════════════════════════════════════════════╝');
  console.log(`  Tables processed : ${tablesDone}`);
  console.log(`  Tables skipped   : ${tablesSkipped}`);
  console.log(`  Total fetched    : ${grandFetched}`);
  if (!opts.dryRun) {
    console.log(`  Total inserted   : ${grandInserted}`);
    console.log(`  Duplicates skipped: ${grandFetched - grandInserted}`);
  }
  console.log(`  Duration         : ${totalSecs}s`);
  console.log('');

  // ── Cleanup ────────────────────────────────────────────────────────────────
  await pool.end();
  await sequelize.close();
  if (sshProc) sshProc.kill('SIGTERM');

  process.exit(0);
}

main().catch(err => {
  console.error('[backfill] Fatal error:', err);
  process.exit(1);
});