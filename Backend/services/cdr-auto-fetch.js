'use strict';

const mysql     = require('mysql2/promise');
const net       = require('net');
const { spawn } = require('child_process');
const CDR       = require('../models/CDR');
const { createNotification } = require('./notification-service');

// ─── Constants ────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS         = 5 * 60_000;   // 5 minutes
const FETCH_BATCH_SIZE         = 500;
const INSERT_BATCH_SIZE        = 500;
const PENDING_IN_CHUNK_SIZE    = 1_000;
const STARTUP_DELAY_MS         = 5_000;
const MIN_POLL_GAP_MS          = 30_000;
const SSH_TUNNEL_RESTART_DELAY = 5_000;

// ─── Checkpoint key ───────────────────────────────────────────────────────────
// flowno is a single CONTINUOUS global sequence across ALL daily tables.
// e_cdr_YYYYMMDD(N) last flowno + 1 == e_cdr_YYYYMMDD(N+1) first flowno.
// One global checkpoint per sourceId is sufficient and correct.
const CHECKPOINT_KEY  = 'mysql_cdr_global_last_flowno';
const FLOWNO_SQL_EXPR = 'CAST(flowno AS UNSIGNED)';

// ─── Env helpers ─────────────────────────────────────────────────────────────

function isEmptyEnv(value) {
  if (value === undefined || value === null) return true;
  return String(value).trim() === '';
}

function firstNonEmptyValue(...values) {
  for (const value of values) {
    if (!isEmptyEnv(value)) return value;
  }
  return undefined;
}

// ─── stoptime normalisation ───────────────────────────────────────────────────

function isOngoingStoptime(rawValue) {
  if (rawValue === null || rawValue === undefined) return true;
  if (typeof rawValue === 'bigint') return rawValue === 0n;
  const n = Number(rawValue);
  if (!Number.isFinite(n)) return true;
  return n === 0;
}

// ─── Column mapping ───────────────────────────────────────────────────────────

function mapRowToCDR(row, sourceTag, opts = {}) {
  const { includeIncomplete = false } = opts;

  if (!includeIncomplete && isOngoingStoptime(row.stoptime)) {
    return null;
  }

  return {
    flowno:               row.flowno?.toString()           ?? null,
    softswitchcallid:     row.softswitchcallid?.toString() ?? null,
    callercallid:         row.callercallid                 ?? null,
    calleroriginalcallid: row.calleroriginalcallid         ?? null,
    callere164:           row.callere164                   ?? null,
    calleraccesse164:     row.calleraccesse164             ?? null,
    callerip:             row.callerip                     ?? null,
    callercodec:          row.callercodec                  ?? null,
    callergatewayid:      row.callergatewayid              ?? null,
    callerproductid:      row.callerproductid              ?? null,
    callertogatewaye164:  row.callertogatewaye164          ?? null,
    callertype:           row.callertype                   ?? null,
    callerareacode:       row.callerareacode               ?? null,
    calleee164:           row.calleee164                   ?? null,
    calleeaccesse164:     row.calleeaccesse164             ?? null,
    calleeip:             row.calleeip                     ?? null,
    calleecodec:          row.calleecodec                  ?? null,
    calleegatewayid:      row.calleegatewayid              ?? null,
    calleeproductid:      row.calleeproductid              ?? null,
    calleetogatewaye164:  row.calleetogatewaye164          ?? null,
    calleetype:           row.calleetype                   ?? null,
    calleeareacode:       row.calleeareacode               ?? null,
    starttime:            row.starttime?.toString()        ?? null,
    stoptime:             row.stoptime?.toString()         ?? null,
    feetime:              row.feetime                      ?? 0,
    agentfeetime:         row.agentfeetime                 ?? 0,
    suitefeetime:         row.suitefeetime                 ?? 0,
    agentsuitefeetime:    row.agentsuitefeetime            ?? 0,
    holdtime:             row.holdtime                     ?? 0,
    callerpdd:            row.callerpdd                    ?? 0,
    calleepdd:            row.calleepdd                    ?? 0,
    fee:                  row.fee                          ?? 0,
    tax:                  row.tax                          ?? 0,
    suitefee:             row.suitefee                     ?? 0,
    incomefee:            row.incomefee                    ?? 0,
    incometax:            row.incometax                    ?? 0,
    agentfee:             row.agentfee                     ?? 0,
    agenttax:             row.agenttax                     ?? 0,
    agentsuitefee:        row.agentsuitefee                ?? 0,
    billingmode:          row.billingmode                  ?? 0,
    billingtype:          row.billingtype                  ?? 0,
    calllevel:            row.calllevel                    ?? 0,
    cdrlevel:             row.cdrlevel                     ?? 0,
    customeraccount:      row.customeraccount              ?? null,
    customername:         row.customername                 ?? null,
    agentaccount:         row.agentaccount                 ?? null,
    agentname:            row.agentname                    ?? null,
    agentcdr_id:          row.agentcdr_id                  ?? null,
    enddirection:         row.enddirection                 ?? null,
    endreason:            row.endreason                    ?? null,
    rtpforward:           row.rtpforward                   ?? 0,
    softswitchname:       row.softswitchname               ?? null,
    source_file:          sourceTag,
  };
}

// ─── Checkpoint helpers ───────────────────────────────────────────────────────

function toBigIntCheckpoint(value) {
  if (value === null || value === undefined) return 0n;
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return BigInt(Math.trunc(value));
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return 0n;
    try { return toBigIntCheckpoint(JSON.parse(trimmed)); } catch { /* fall through */ }
    let normalized = trimmed;
    while (normalized.length >= 2) {
      const first = normalized[0];
      const last  = normalized[normalized.length - 1];
      if (
        (first === '"' && last === '"') ||
        (first === "'" && last === "'")
      ) {
        normalized = normalized.slice(1, -1).trim();
      } else {
        break;
      }
    }
    if (/^-?\d+$/.test(normalized)) return BigInt(normalized);
    return 0n;
  }
  if (typeof value === 'object') {
    if (value.flowno != null) return toBigIntCheckpoint(value.flowno);
    if (value.value  != null) return toBigIntCheckpoint(value.value);
  }
  return 0n;
}

async function getGlobalCheckpoint(sourceId) {
  const SystemSetting = require('../models/SystemSetting');
  const key     = `${CHECKPOINT_KEY}_${sourceId}`;
  const setting = await SystemSetting.findOne({ where: { key }, raw: true });
  return setting ? toBigIntCheckpoint(setting.value) : 0n;
}

async function saveGlobalCheckpoint(sourceId, flowno) {
  const SystemSetting = require('../models/SystemSetting');
  const key = `${CHECKPOINT_KEY}_${sourceId}`;
  await SystemSetting.upsert({ key, value: { flowno: flowno.toString() } });
}

// ─── Table discovery ──────────────────────────────────────────────────────────
// Returns all e_cdr_YYYYMMDD table names that exist in the DB, sorted
// oldest-first (ascending by date suffix).
// This is used instead of a fixed daysBack window — since flowno is a
// continuous series, we simply need to find every table that has rows with
// flowno > globalCursor, regardless of which calendar day it belongs to.

async function getOrderedCDRTables(pool) {
  const [rows] = await pool.query(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = DATABASE()
       AND table_name REGEXP '^e_cdr_[0-9]{8}$'
     ORDER BY table_name ASC`   // alphabetical == chronological for YYYYMMDD
  );
  return rows.map(r => r.table_name || r.TABLE_NAME);
}

// Given the global cursor, find which tables could possibly contain
// flowno > cursor by checking MAX(flowno) per table.
// Tables whose MAX flowno <= cursor are fully consumed and skipped.
// This avoids full-table scans on old tables every poll cycle.

async function getActiveTables(pool, globalCursor) {
  const allTables = await getOrderedCDRTables(pool);
  if (!allTables.length) return [];

  // Build a UNION query: SELECT 'tableName' AS t, MAX(CAST(flowno AS UNSIGNED)) AS mx FROM `tableName`
  // Doing this in one round-trip is faster than N individual queries.
  const unionSql = allTables
    .map(t => `SELECT '${t}' AS t, MAX(${FLOWNO_SQL_EXPR}) AS mx FROM \`${t}\``)
    .join(' UNION ALL ');

  let maxRows;
  try {
    [maxRows] = await pool.query(unionSql);
  } catch (err) {
    // Fallback: if UNION fails (e.g. too many tables), include all tables.
    console.warn(`[getActiveTables] UNION query failed, including all tables: ${err.message}`);
    return allTables;
  }

  // Keep only tables where MAX(flowno) > globalCursor (i.e. they have unread rows).
  const active = maxRows
    .filter(r => r.mx !== null && BigInt(r.mx) > globalCursor)
    .map(r => r.t);

  // active is already in ascending (oldest-first) order because allTables is sorted.
  return active;
}

// ─── Pending CDR helper ───────────────────────────────────────────────────────

async function queuePending(sourceId, tableName, flownos) {
  if (!flownos.length) return;
  const PendingCDR = require('../models/PendingCDR');
  const nowMs = Date.now().toString();
  try {
    await PendingCDR.bulkCreate(
      flownos.map(f => ({
        source_id:  sourceId,
        table_name: tableName,
        flowno:     f.toString(),
        first_seen: nowMs,
      })),
      { ignoreDuplicates: true }
    );
  } catch (err) {
    console.error(
      `[MySQLCDRFetcher:${sourceId}] queuePending error on ${tableName}:`,
      err.message
    );
  }
}

// ─── Bulk insert helper ───────────────────────────────────────────────────────
// Dedup by flowno only — flowno is globally unique across all daily tables.

async function bulkInsertCDRs(mapped) {
  if (!mapped.length) return 0;

  const flownos = mapped.map(c => c.flowno).filter(Boolean);
  let existingFlownos = new Set();

  if (flownos.length) {
    const existingRows = await CDR.findAll({
      attributes: ['flowno'],
      where:      { flowno: flownos },
      raw:        true,
    });
    existingFlownos = new Set(existingRows.map(r => String(r.flowno)));
  }

  const deduped = mapped.filter(
    c => c.flowno && !existingFlownos.has(String(c.flowno))
  );

  if (!deduped.length) return 0;

  let inserted = 0;
  for (let i = 0; i < deduped.length; i += INSERT_BATCH_SIZE) {
    const batch = deduped.slice(i, i + INSERT_BATCH_SIZE);
    await CDR.bulkCreate(batch, {
      ignoreDuplicates: true,
      validate:         false,
    });
    inserted += batch.length;
  }

  return inserted;
}

// ─── Core fetch function ──────────────────────────────────────────────────────
// fetchAndInsertTable processes ONE daily table starting from globalCursor.
//
// KEY CHANGE vs. old version:
//   - No stall detection / force-advance. The source guarantees a strict,
//     gapless, monotonically increasing flowno series, so a stall means we
//     have genuinely reached the end of completed rows in this table — just stop.
//   - MAX(flowno) of this table is fetched upfront. If the table's MAX equals
//     highestCompletedFlowno after Phase A, we know we have drained the table
//     completely and the next table's first row will continue the sequence.
//   - The caller (_fetchAndInsert) threads highestSeen between tables, so the
//     cursor for table[N+1] is always max(globalCursor, table[N] maxFlowno processed).

async function fetchAndInsertTable(pool, sourceId, tableName, globalCursor) {
  // Guard: skip silently if table doesn't exist yet.
  try {
    await pool.query(`SELECT 1 FROM \`${tableName}\` LIMIT 1`);
  } catch {
    return null;
  }

  const PendingCDR = require('../models/PendingCDR');
  const sourceTag  = `${sourceId}:${tableName}`;

  let totalFetched  = 0;
  let totalInserted = 0;
  let highestCompletedFlowno = globalCursor;

  // ── Fetch this table's MAX(flowno) for logging / sanity only ─────────────
  let tableMaxFlowno = 0n;
  try {
    const [[maxRow]] = await pool.query(
      `SELECT MAX(${FLOWNO_SQL_EXPR}) AS mx FROM \`${tableName}\``
    );
    if (maxRow?.mx != null) tableMaxFlowno = BigInt(maxRow.mx);
  } catch (err) {
    console.warn(
      `[MySQLCDRFetcher:${sourceId}] Could not fetch MAX(flowno) for ${tableName}: ${err.message}`
    );
  }

  // If this table's highest flowno is already <= the global cursor, it is
  // fully consumed. Skip all phases — nothing new to read.
  if (tableMaxFlowno <= globalCursor) {
    console.log(
      `[MySQLCDRFetcher:${sourceId}] ${tableName} fully consumed ` +
      `(MAX flowno ${tableMaxFlowno} <= cursor ${globalCursor}), skipping`
    );
    return { fetched: 0, inserted: 0, highestCompletedFlowno: globalCursor };
  }

  console.log(
    `[MySQLCDRFetcher:${sourceId}] Processing ${tableName} | ` +
    `cursor=${globalCursor} | tableMax=${tableMaxFlowno}`
  );

  // ══════════════════════════════════════════════════════════════════════════
  // PRE-SCAN — queue ongoing (stoptime=0/NULL) rows into pending_cdrs.
  // Only scans rows above globalCursor (rows below were handled in prior polls).
  // ══════════════════════════════════════════════════════════════════════════
  {
    let pendingCursor = globalCursor;

    while (true) {
      let ongoingRows;
      try {
        [ongoingRows] = await pool.query(
          `SELECT flowno FROM \`${tableName}\`
           WHERE ${FLOWNO_SQL_EXPR} > ?
             AND (stoptime IS NULL OR stoptime = 0)
           ORDER BY ${FLOWNO_SQL_EXPR} ASC
           LIMIT ?`,
          [pendingCursor.toString(), FETCH_BATCH_SIZE]
        );
      } catch (err) {
        console.error(
          `[MySQLCDRFetcher:${sourceId}] PRE-SCAN error on ${tableName}:`,
          err.message
        );
        break;
      }

      if (!ongoingRows.length) break;

      await queuePending(sourceId, tableName, ongoingRows.map(r => r.flowno));

      console.log(
        `[MySQLCDRFetcher:${sourceId}] Queued ${ongoingRows.length} ` +
        `ongoing flowno(s) into pending_cdrs from ${tableName}`
      );

      pendingCursor = BigInt(ongoingRows[ongoingRows.length - 1].flowno);
      if (ongoingRows.length < FETCH_BATCH_SIZE) break;
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE A — fetch all completed rows (stoptime > 0) above globalCursor.
  //
  // Because flowno is a strict continuous series within each table AND across
  // tables, there are NO stalls, NO gaps, NO out-of-order rows. We simply page
  // forward until the batch is smaller than FETCH_BATCH_SIZE (end of available
  // completed rows in this table). No force-advance logic needed.
  // ══════════════════════════════════════════════════════════════════════════
  let cursor = globalCursor;

  while (true) {
    let rows;
    try {
      [rows] = await pool.query(
        `SELECT * FROM \`${tableName}\`
         WHERE ${FLOWNO_SQL_EXPR} > ?
           AND stoptime IS NOT NULL AND stoptime > 0
         ORDER BY ${FLOWNO_SQL_EXPR} ASC
         LIMIT ?`,
        [cursor.toString(), FETCH_BATCH_SIZE]
      );
    } catch (err) {
      console.error(
        `[MySQLCDRFetcher:${sourceId}] PHASE A query error on ${tableName} ` +
        `at cursor ${cursor}: ${err.message} — will retry next poll`
      );
      break;
    }

    if (!rows.length) break;

    const mapped   = [];
    const rejected = [];   // passed SQL filter but JS still sees stoptime=0 (data race)

    for (const row of rows) {
      const cdr = mapRowToCDR(row, sourceTag, { includeIncomplete: false });
      if (cdr) {
        mapped.push(cdr);
      } else {
        rejected.push(row.flowno);
      }
    }

    if (rejected.length) {
      console.warn(
        `[MySQLCDRFetcher:${sourceId}] PHASE A: ${rejected.length} row(s) in ${tableName} ` +
        `passed SQL filter but rejected by mapRowToCDR — queuing to pending_cdrs. ` +
        `flowno range: ${rejected[0]}..${rejected[rejected.length - 1]}`
      );
      await queuePending(sourceId, tableName, rejected);
    }

    try {
      if (mapped.length) {
        const inserted = await bulkInsertCDRs(mapped);
        totalInserted += inserted;
      }
    } catch (err) {
      console.error(
        `[MySQLCDRFetcher:${sourceId}] PHASE A insert error on ${tableName} ` +
        `at cursor ${cursor}: ${err.message} — will retry next poll`
      );
      break;
    }

    totalFetched += rows.length;

    // Advance cursor to the last flowno in this page.
    // Because the series is continuous and strictly ascending, the last
    // flowno in the page is always > cursor — no stall check needed.
    const lastFlowno = BigInt(rows[rows.length - 1].flowno);
    cursor = lastFlowno;

    if (cursor > highestCompletedFlowno) {
      highestCompletedFlowno = cursor;
    }

    // Full page → more rows may follow; continue.
    // Partial page → we've reached the end of currently-available completed
    // rows in this table. Stop — the next poll will pick up from here.
    if (rows.length < FETCH_BATCH_SIZE) break;
  }

  if (totalFetched > 0) {
    console.log(
      `[MySQLCDRFetcher:${sourceId}] ${tableName}: ` +
      `fetched ${totalFetched}, inserted ${totalInserted}, ` +
      `cursor advanced to ${highestCompletedFlowno} (tableMax=${tableMaxFlowno})`
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE B — resolve previously-pending (was-ongoing) rows for this table.
  // Pending rows may have flowno below the global cursor but weren't inserted
  // yet because stoptime was 0 when they were first seen.
  // ══════════════════════════════════════════════════════════════════════════
  const pendingRows = await PendingCDR.findAll({
    where: { source_id: sourceId, table_name: tableName },
    raw:   true,
  });

  if (pendingRows.length) {
    const pendingFlownos = pendingRows.map(p => p.flowno);
    let   nowResolved    = [];

    for (let i = 0; i < pendingFlownos.length; i += PENDING_IN_CHUNK_SIZE) {
      const chunk = pendingFlownos.slice(i, i + PENDING_IN_CHUNK_SIZE);
      try {
        const [chunkRows] = await pool.query(
          `SELECT * FROM \`${tableName}\`
           WHERE flowno IN (?)
             AND stoptime IS NOT NULL
             AND stoptime > 0`,
          [chunk]
        );
        nowResolved = nowResolved.concat(chunkRows);
      } catch (err) {
        console.error(
          `[MySQLCDRFetcher:${sourceId}] PHASE B chunk query error for ${tableName}:`,
          err.message
        );
      }
    }

    if (nowResolved.length) {
      const mapped = nowResolved
        .map(row => mapRowToCDR(row, sourceTag, { includeIncomplete: false }))
        .filter(Boolean);

      if (mapped.length) {
        const recovered = await bulkInsertCDRs(mapped);
        totalInserted += recovered;
        if (recovered > 0) {
          console.log(
            `[MySQLCDRFetcher:${sourceId}] Recovered ${recovered} ` +
            `previously-pending CDR(s) from ${tableName}`
          );
        }
      }

      const resolvedFlownoSet = new Set(nowResolved.map(r => r.flowno.toString()));
      const resolvedFlownos   = [...resolvedFlownoSet];

      for (let i = 0; i < resolvedFlownos.length; i += PENDING_IN_CHUNK_SIZE) {
        const chunk = resolvedFlownos.slice(i, i + PENDING_IN_CHUNK_SIZE);
        try {
          await PendingCDR.destroy({
            where: { source_id: sourceId, table_name: tableName, flowno: chunk },
          });
        } catch (err) {
          console.error(
            `[MySQLCDRFetcher:${sourceId}] PHASE B destroy error for ${tableName}:`,
            err.message
          );
        }
      }

      console.log(
        `[MySQLCDRFetcher:${sourceId}] Cleared ${resolvedFlownos.length} ` +
        `resolved flowno(s) from pending_cdrs for ${tableName}`
      );
    }

    const stillPending = pendingFlownos.length - nowResolved.length;
    if (stillPending > 0) {
      console.log(
        `[MySQLCDRFetcher:${sourceId}] ${stillPending} flowno(s) still ` +
        `in-progress in ${tableName}`
      );
    }
  }

  return {
    fetched:               totalFetched,
    inserted:              totalInserted,
    highestCompletedFlowno,
  };
}

// ─── Service class ────────────────────────────────────────────────────────────

class MySQLCDRFetcher {
  constructor(config = {}) {
    const hasSshEnv = Boolean(
      !isEmptyEnv(process.env.SERVER_IP)    &&
      !isEmptyEnv(process.env.SSH_USERNAME) &&
      !isEmptyEnv(process.env.SSH_KEY_PATH)
    );
    const explicitTunnelFlag = process.env.MYSQL_CDR_USE_SSH_TUNNEL;
    const useSshTunnel = explicitTunnelFlag === undefined
      ? hasSshEnv
      : String(explicitTunnelFlag).toLowerCase() === 'true';

    const envConfig = {
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

    this.config   = { ...envConfig, ...config };
    this.sourceId = this.config.sourceId;
    this.pool     = null;
    this.started  = false;
    this.running  = false;
    this.lastRunAt         = 0;
    this._interval         = null;
    this._sshTunnelProcess = null;
    this._tunnelReady      = false;

    this._onProcessExit = () => {
      if (this._sshTunnelProcess) {
        this._sshTunnelProcess.kill('SIGTERM');
        this._sshTunnelProcess = null;
      }
    };

    process.on('exit',    this._onProcessExit);
    process.on('SIGINT',  this._onProcessExit);
    process.on('SIGTERM', this._onProcessExit);

    this.start().catch((err) => {
      console.error(`[MySQLCDRFetcher:${this.sourceId}] Failed to start:`, err.message);
    });
  }

  async start() {
    if (this.started) return;

    const required = ['user', 'database'];
    if (!this.config.useSshTunnel) required.unshift('host');
    const missing = required.filter((key) => !this.config[key]);
    if (missing.length) {
      console.warn(`[MySQLCDRFetcher:${this.sourceId}] Disabled — missing config: ${missing.join(', ')}`);
      return;
    }

    this.started = true;

    const dbAddr = this.config.useSshTunnel
      ? `127.0.0.1:${this.config.tunnelLocalPort}`
      : `${this.config.host}:${this.config.port}`;

    console.log(
      `[MySQLCDRFetcher:${this.sourceId}] ` +
      `mode=${this.config.useSshTunnel ? 'ssh-tunnel' : 'direct'} ` +
      `db=${this.config.database} mysql=${dbAddr}`
    );

    if (this.config.useSshTunnel) {
      await this._startSshTunnel();
    } else {
      this._tunnelReady = true;
    }

    this._createPool();

    try {
      const conn = await this.pool.getConnection();
      await conn.ping();
      conn.release();
      console.log(`[MySQLCDRFetcher:${this.sourceId}] Connected to source DB`);
    } catch (err) {
      console.error(`[MySQLCDRFetcher:${this.sourceId}] Cannot connect to source DB:`, err.message);
    }

    setTimeout(() => {
      this._poll();
      this._interval = setInterval(() => this._poll(), POLL_INTERVAL_MS);
    }, STARTUP_DELAY_MS);

    console.log(
      `[MySQLCDRFetcher:${this.sourceId}] Fetcher started — ` +
      `polling every ${POLL_INTERVAL_MS / 1000}s`
    );
  }

  stop() {
    if (this._interval) { clearInterval(this._interval); this._interval = null; }
    if (this.pool) {
      this.pool.end().catch(err =>
        console.error(`[MySQLCDRFetcher:${this.sourceId}] Error closing pool:`, err)
      );
      this.pool = null;
    }
    if (this._sshTunnelProcess) {
      this._sshTunnelProcess.kill('SIGTERM');
      this._sshTunnelProcess = null;
    }
    process.off('exit',    this._onProcessExit);
    process.off('SIGINT',  this._onProcessExit);
    process.off('SIGTERM', this._onProcessExit);
    this.started      = false;
    this._tunnelReady = false;
    console.log(`[MySQLCDRFetcher:${this.sourceId}] Fetcher stopped`);
  }

  _createPool() {
    if (this.pool) { this.pool.end().catch(() => {}); this.pool = null; }
    this.pool = mysql.createPool({
      host:               this.config.useSshTunnel ? '127.0.0.1' : this.config.host,
      port:               this.config.useSshTunnel
                            ? this.config.tunnelLocalPort
                            : (this.config.port || 3306),
      user:               this.config.user,
      password:           this.config.password,
      database:           this.config.database,
      waitForConnections: true,
      connectionLimit:    3,
      queueLimit:         10,
      connectTimeout:     10_000,
      multipleStatements: false,
    });
  }

  async _canConnectLocalPort(port) {
    return new Promise((resolve) => {
      const socket = net.createConnection({ host: '127.0.0.1', port });
      socket.once('connect', () => { socket.destroy(); resolve(true);  });
      socket.once('error',   () => { socket.destroy(); resolve(false); });
    });
  }

  async _waitForTunnelPort() {
    await new Promise((resolve, reject) => {
      const startedAt = Date.now();
      const tryConnect = () => {
        const socket = net.createConnection({
          host: '127.0.0.1',
          port: this.config.tunnelLocalPort,
        });
        socket.once('connect', () => { socket.destroy(); resolve(); });
        socket.once('error',   () => {
          socket.destroy();
          if (Date.now() - startedAt > 25_000) {
            reject(new Error(
              `SSH tunnel did not open port ${this.config.tunnelLocalPort} within 25s. ` +
              `Check SSH_KEY_PATH, SERVER_IP, SSH_USERNAME, SSH_PORT and firewall rules.`
            ));
            return;
          }
          setTimeout(tryConnect, 250);
        });
      };
      tryConnect();
    });
  }

  async _startSshTunnel() {
    if (this._sshTunnelProcess) return;

    const portInUse = await this._canConnectLocalPort(this.config.tunnelLocalPort);
    if (portInUse) {
      console.log(
        `[MySQLCDRFetcher:${this.sourceId}] ` +
        `Reusing existing tunnel on localhost:${this.config.tunnelLocalPort}`
      );
      this._tunnelReady = true;
      return;
    }

    const required = ['sshHost', 'sshUser', 'sshPort', 'sshKeyPath'];
    const missing  = required.filter((key) => !this.config[key]);
    if (missing.length) {
      throw new Error(`SSH tunnel enabled but missing config: ${missing.join(', ')}`);
    }

    const args = [
      '-N',
      '-L', `${this.config.tunnelLocalPort}:${this.config.tunnelRemoteHost}:${this.config.tunnelRemotePort}`,
      '-i', this.config.sshKeyPath,
      '-p', String(this.config.sshPort),
      '-o', 'BatchMode=yes',
      '-o', 'ExitOnForwardFailure=yes',
      '-o', 'StrictHostKeyChecking=no',
      '-o', 'ServerAliveInterval=30',
      '-o', 'ServerAliveCountMax=3',
      `${this.config.sshUser}@${this.config.sshHost}`,
    ];

    const spawnTunnel = () => {
      this._tunnelReady      = false;
      this._sshTunnelProcess = spawn('ssh', args, {
        stdio: ['ignore', 'ignore', 'pipe'],
      });

      this._sshTunnelProcess.stderr.on('data', (chunk) => {
        const msg = String(chunk || '').trim();
        if (msg) console.error(`[MySQLCDRFetcher:${this.sourceId}] SSH tunnel: ${msg}`);
      });

      this._sshTunnelProcess.once('exit', (code) => {
        this._sshTunnelProcess = null;
        this._tunnelReady      = false;

        if (this.started) {
          console.warn(
            `[MySQLCDRFetcher:${this.sourceId}] SSH tunnel exited ` +
            `(code=${code}), restarting in ${SSH_TUNNEL_RESTART_DELAY / 1000}s...`
          );
          setTimeout(async () => {
            try {
              spawnTunnel();
              await this._waitForTunnelPort();
              this._createPool();
              this._tunnelReady = true;
              console.log(
                `[MySQLCDRFetcher:${this.sourceId}] SSH tunnel restored and pool recreated`
              );
            } catch (err) {
              console.error(
                `[MySQLCDRFetcher:${this.sourceId}] Failed to restore SSH tunnel:`,
                err.message
              );
            }
          }, SSH_TUNNEL_RESTART_DELAY);
        }
      });
    };

    spawnTunnel();
    await this._waitForTunnelPort();
    this._tunnelReady = true;
    console.log(
      `[MySQLCDRFetcher:${this.sourceId}] ` +
      `SSH tunnel ready on localhost:${this.config.tunnelLocalPort}`
    );
  }

  async _poll() {
    const now = Date.now();

    if (this.running) {
      console.warn(`[MySQLCDRFetcher:${this.sourceId}] Skipped — previous poll still running`);
      return;
    }
    if (this.lastRunAt && (now - this.lastRunAt) < MIN_POLL_GAP_MS) return;
    if (!this._tunnelReady) {
      console.warn(`[MySQLCDRFetcher:${this.sourceId}] Skipped — SSH tunnel not ready`);
      return;
    }

    this.running   = true;
    this.lastRunAt = now;

    try {
      await this._fetchAndInsert();
    } catch (err) {
      console.error(`[MySQLCDRFetcher:${this.sourceId}] Poll error:`, err.message);
    } finally {
      this.running = false;
    }
  }

  async _fetchAndInsert() {
    const startedAt = Date.now();

    // Load the single global cursor (highest flowno already stored).
    const globalCursor = await getGlobalCheckpoint(this.sourceId);

    // ── Discover which tables actually have new rows above the cursor ─────────
    // getActiveTables:
    //   1. Lists all e_cdr_YYYYMMDD tables from information_schema (sorted oldest-first).
    //   2. Fetches MAX(flowno) per table in one UNION query.
    //   3. Filters to only tables where MAX(flowno) > globalCursor.
    //
    // This replaces the old fixed `getRecentTableNames(daysBack)` window, which
    // would silently skip tables if the backlog grew beyond LIVE_POLL_DAYS_BACK.
    // With a continuous flowno series, "active" simply means "has rows we haven't
    // processed yet", regardless of which calendar day the table covers.
    let tables;
    try {
      tables = await getActiveTables(this.pool, globalCursor);
    } catch (err) {
      console.error(
        `[MySQLCDRFetcher:${this.sourceId}] Failed to discover active tables: ${err.message}`
      );
      return;
    }

    if (!tables.length) {
      console.log(
        `[MySQLCDRFetcher:${this.sourceId}] No new rows above cursor ${globalCursor}`
      );
      return;
    }

    console.log(
      `[MySQLCDRFetcher:${this.sourceId}] Active tables: [${tables.join(', ')}] | cursor=${globalCursor}`
    );

    let highestSeen   = globalCursor;
    let totalFetched  = 0;
    let totalInserted = 0;

    // Process tables oldest-first. Thread highestSeen between tables so each
    // subsequent table starts from the cursor left by the previous one.
    // This is safe because flowno is continuous: table[N] max + 1 == table[N+1] min.
    for (const tableName of tables) {
      const result = await fetchAndInsertTable(
        this.pool, this.sourceId, tableName, highestSeen
      );

      if (!result) continue;

      totalFetched  += result.fetched;
      totalInserted += result.inserted;

      if (result.highestCompletedFlowno > highestSeen) {
        highestSeen = result.highestCompletedFlowno;
      }
    }

    // Persist checkpoint once after all tables — reflects everything committed.
    if (highestSeen > globalCursor) {
      await saveGlobalCheckpoint(this.sourceId, highestSeen);
      console.log(
        `[MySQLCDRFetcher:${this.sourceId}] Global checkpoint advanced ` +
        `${globalCursor} → ${highestSeen}`
      );
    }

    const durationMs = Date.now() - startedAt;

    if (totalInserted > 0) {
      console.log(
        `[MySQLCDRFetcher:${this.sourceId}] ` +
        `Fetched ${totalFetched} row(s), inserted ${totalInserted} NEW in ${durationMs}ms`
      );
      await createNotification({
        title:    'CDR sync complete',
        message:  `${totalInserted} new CDR(s) imported from ${this.sourceId}`,
        type:     'info',
        category: 'cdr-sync',
        metadata: { totalFetched, totalInserted, sourceId: this.sourceId, durationMs },
      }).catch(err =>
        console.error(`[MySQLCDRFetcher:${this.sourceId}] Notification error:`, err)
      );
    } else if (totalFetched > 0) {
      console.log(
        `[MySQLCDRFetcher:${this.sourceId}] ` +
        `Fetched ${totalFetched} row(s), 0 new (all already stored) in ${durationMs}ms`
      );
    } else {
      console.log(
        `[MySQLCDRFetcher:${this.sourceId}] No new completed rows above cursor ${globalCursor}`
      );
    }
  }
}

module.exports = { MySQLCDRFetcher, fetchAndInsertTable };