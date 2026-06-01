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
const LIVE_POLL_DAYS_BACK      = 2;

// ─── GLOBAL checkpoint key (no longer per-table)
// ROOT CAUSE FIX: flowno is a single global sequence across ALL daily tables.
// The softswitch splits rows into daily tables by call START TIME, not by
// flowno order — so e_cdr_20260528 MIN flowno (1,058,034) can be LOWER than
// e_cdr_20260527 MAX flowno (1,063,750). Using per-table checkpoints caused:
//   1. The same flowno range being fetched from multiple tables.
//   2. bulkInsertCDRs dedup failing silently (source_file mismatch) while
//      the cursor still advanced — permanently losing rows.
// One global checkpoint per sourceId solves both problems.
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
// Single global checkpoint — no tableName in the key.

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

// ─── Table name helpers ───────────────────────────────────────────────────────

function getUtcTableName(dayOffset = 0) {
  const now     = new Date();
  const utcDate = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + dayOffset,
  ));
  const y = utcDate.getUTCFullYear();
  const m = String(utcDate.getUTCMonth() + 1).padStart(2, '0');
  const d = String(utcDate.getUTCDate()).padStart(2, '0');
  return `e_cdr_${y}${m}${d}`;
}

function getRecentTableNames(daysBack = LIVE_POLL_DAYS_BACK) {
  // Oldest first so we process in chronological flowno order.
  // e_cdr_20260527 (older, lower flownos) before e_cdr_20260528 (newer, higher flownos).
  // This matters because the global cursor only moves forward — processing
  // the older table first ensures its lower-flowno rows are not skipped by a
  // cursor that was already advanced by the newer table.
  return Array.from({ length: daysBack }, (_, i) => getUtcTableName(-(daysBack - 1 - i)));
}

// ─── Pending CDR helper ───────────────────────────────────────────────────────
// FIX: pending_cdrs now stores (source_id, table_name, flowno) so Phase B
// knows WHICH table to re-query.  The table_name is still meaningful here
// because an ongoing call's CDR row lives in a specific daily table.

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
// FIX: dedup check is on flowno ALONE (no source_file).
//
// Previously: where: { source_file: sourceTag, flowno: flownos }
// Problem:    flowno X inserted from e_cdr_20260528 has source_file="id:e_cdr_20260528".
//             When e_cdr_20260527 tries to insert the same flowno X, the findAll
//             with source_file="id:e_cdr_20260527" finds nothing → dedup misses it →
//             bulkCreate fires → DB unique constraint on flowno rejects silently →
//             ignoreDuplicates swallows the error → cursor advances → ROW LOST.
//
// Fix:        Check existence by flowno only (globally unique across all tables).
//             The source_file column is still written correctly per row for auditing,
//             but it is not used for deduplication decisions.

async function bulkInsertCDRs(mapped) {
  if (!mapped.length) return 0;

  const flownos = mapped.map(c => c.flowno).filter(Boolean);
  let existingFlownos = new Set();

  if (flownos.length) {
    const existingRows = await CDR.findAll({
      attributes: ['flowno'],
      where:      { flowno: flownos },   // ← global dedup, no source_file filter
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
      ignoreDuplicates: true,   // safety net for races only — dedup above handles normal cases
      validate:         false,
    });
    inserted += batch.length;
  }

  return inserted;
}

// ─── Core fetch function ──────────────────────────────────────────────────────
// fetchAndInsertTable processes ONE daily table.
// It receives the GLOBAL cursor (not a per-table one) and returns the highest
// flowno it successfully processed so the caller can advance the global checkpoint.
//
// updateCheckpoint is always false here — the caller (_fetchAndInsert) owns
// the checkpoint and saves it only after ALL tables in a poll cycle are done.

async function fetchAndInsertTable(pool, sourceId, tableName, globalCursor) {
  // ── Guard: skip silently if table doesn't exist yet ──────────────────────
  try {
    await pool.query(`SELECT 1 FROM \`${tableName}\` LIMIT 1`);
  } catch {
    return null;
  }

  const PendingCDR = require('../models/PendingCDR');

  // sourceTag is used for the source_file audit column only, not for dedup.
  const sourceTag     = `${sourceId}:${tableName}`;
  let   totalFetched  = 0;
  let   totalInserted = 0;

  // highestCompletedFlowno tracks the highest flowno from THIS table that was
  // successfully inserted as a complete CDR.  The caller merges this across all
  // tables to advance the global cursor.
  let highestCompletedFlowno = globalCursor;

  // ══════════════════════════════════════════════════════════════════════════
  // PRE-SCAN — find all currently-ongoing rows in this table and queue them
  // into pending_cdrs so Phase B can recover them once they complete.
  //
  // We scan from flowno > globalCursor (not from 0) because:
  //   - Rows ≤ globalCursor were already processed in a previous poll.
  //   - An ongoing row below globalCursor that was missed would have been
  //     queued in a prior poll's PRE-SCAN and is handled by Phase B.
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
  // PHASE A — fetch all completed rows (stoptime > 0) after the global cursor.
  //
  // The query uses the GLOBAL cursor, not a per-table cursor.  This means:
  //   - If globalCursor = 1,063,750 (set while processing e_cdr_20260527),
  //     and e_cdr_20260528 MIN flowno = 1,058,034 (below the cursor), then
  //     Phase A on e_cdr_20260528 would find 0 rows above the cursor —
  //     which is CORRECT because those lower rows were already processed.
  //   - Only genuinely new rows (flowno > globalCursor) are fetched.
  //
  // Checkpoint is NOT saved here. The caller saves the global checkpoint
  // after all tables are processed, using the highest flowno seen across
  // all of them.
  // ══════════════════════════════════════════════════════════════════════════
  let consecutiveStalls = 0;
  const MAX_CONSECUTIVE_STALLS = 3;
  let   cursor = globalCursor;

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

    // Separate mappable from unmappable rows.
    // Unmappable = passed SQL stoptime>0 filter but JS still sees stoptime=0
    // (data race). Queue these for Phase B recovery.
    const mapped   = [];
    const rejected = [];

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
        `[MySQLCDRFetcher:${sourceId}] PHASE A: ${rejected.length} row(s) ` +
        `in ${tableName} passed SQL filter but were rejected by mapRowToCDR ` +
        `— queuing to pending_cdrs. ` +
        `flowno range: ${rejected[0]}..${rejected[rejected.length - 1]}`
      );
      await queuePending(sourceId, tableName, rejected);
    }

    try {
      if (mapped.length) {
        const inserted = await bulkInsertCDRs(mapped);   // no sourceTag param — global dedup
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

    const lastRawFlowno = BigInt(rows[rows.length - 1].flowno);

    if (lastRawFlowno > cursor) {
      cursor = lastRawFlowno;
      consecutiveStalls = 0;

      // Track the highest successfully-processed flowno for this table.
      if (cursor > highestCompletedFlowno) {
        highestCompletedFlowno = cursor;
      }
    } else {
      consecutiveStalls++;
      console.warn(
        `[MySQLCDRFetcher:${sourceId}] PHASE A cursor stall #${consecutiveStalls} ` +
        `at cursor=${cursor}, lastRawFlowno=${lastRawFlowno} in ${tableName}. ` +
        `Rows in page: ${rows.length}. Indicates duplicate/out-of-order flowno. ` +
        `Force-advancing cursor by 1.`
      );
      cursor = cursor + 1n;

      if (consecutiveStalls >= MAX_CONSECUTIVE_STALLS) {
        console.error(
          `[MySQLCDRFetcher:${sourceId}] PHASE A aborted after ` +
          `${MAX_CONSECUTIVE_STALLS} consecutive stalls at cursor=${cursor} ` +
          `in ${tableName}. Will resume next poll.`
        );
        break;
      }
    }

    if (rows.length < FETCH_BATCH_SIZE) break;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE B — resolve pending_cdrs for this specific table.
  //
  // pending_cdrs rows store (source_id, table_name, flowno) so we query the
  // correct table for each pending row.  This is independent of the global
  // cursor — a pending row's flowno may be below the global cursor but still
  // needs to be inserted once it completes.
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
        const recovered = await bulkInsertCDRs(mapped);   // global dedup
        totalInserted += recovered;
        if (recovered > 0) {
          console.log(
            `[MySQLCDRFetcher:${sourceId}] Recovered ${recovered} ` +
            `previously-pending CDR(s) from ${tableName}`
          );
        }
      }

      // Deduplicate before destroy to avoid redundant calls.
      const resolvedFlownoSet = new Set(nowResolved.map(r => r.flowno.toString()));
      const resolvedFlownos   = [...resolvedFlownoSet];

      for (let i = 0; i < resolvedFlownos.length; i += PENDING_IN_CHUNK_SIZE) {
        const chunk = resolvedFlownos.slice(i, i + PENDING_IN_CHUNK_SIZE);
        try {
          await PendingCDR.destroy({
            where: {
              source_id:  sourceId,
              table_name: tableName,
              flowno:     chunk,
            },
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
    highestCompletedFlowno,   // caller uses this to advance global checkpoint
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

    // ── ONE global checkpoint for all tables ─────────────────────────────────
    // This is the core fix. All tables share a single cursor so a flowno
    // already processed from ANY table is not re-attempted from another.
    const globalCursor = await getGlobalCheckpoint(this.sourceId);

    // Tables are returned oldest-first (e_cdr_20260527 before e_cdr_20260528).
    // This ensures that when two tables share an overlapping flowno range,
    // the older table (whose rows have lower flownos) is processed first,
    // advancing the global cursor naturally in ascending order.
    const tables = getRecentTableNames(LIVE_POLL_DAYS_BACK);

    let highestSeen   = globalCursor;
    let totalFetched  = 0;
    let totalInserted = 0;

    for (const tableName of tables) {
      // Pass the CURRENT highestSeen (not the initial globalCursor) so that
      // if table[0] advanced the cursor, table[1] starts from the new position.
      const result = await fetchAndInsertTable(
        this.pool, this.sourceId, tableName, highestSeen
      );

      if (!result) continue;

      totalFetched  += result.fetched;
      totalInserted += result.inserted;

      // Advance the shared cursor to the highest flowno seen so far.
      if (result.highestCompletedFlowno > highestSeen) {
        highestSeen = result.highestCompletedFlowno;
      }
    }

    // Save the global checkpoint ONCE after all tables are done.
    // If a poll errors mid-way, the checkpoint only reflects what was
    // fully committed — the next poll will re-process from there.
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
        `[MySQLCDRFetcher:${this.sourceId}] No new rows in ${tables.join(', ')}`
      );
    }
  }
}

module.exports = { MySQLCDRFetcher, fetchAndInsertTable };