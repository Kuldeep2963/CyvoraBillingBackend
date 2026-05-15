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
const PENDING_IN_CHUNK_SIZE    = 1_000;         // FIX: chunk IN() queries to avoid max_allowed_packet
const STARTUP_DELAY_MS         = 5_000;
const MIN_POLL_GAP_MS          = 30_000;
const SSH_TUNNEL_RESTART_DELAY = 5_000;
const CHECKPOINT_KEY           = 'mysql_cdr_last_flowno';

const LIVE_POLL_DAYS_BACK = 2;

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

// ─── Column mapping ───────────────────────────────────────────────────────────

/**
 * Maps a raw source DB row to a local CDR shape.
 *
 * INSERTION RULE — stoptime only:
 *   Ongoing  →  stoptime IS NULL or stoptime = 0  →  returns null (queued to pending_cdrs)
 *   All other rows  →  insert immediately (completed, failed, rejected, etc.)
 *
 * NOTE: includeIncomplete=true bypasses the stoptime guard (used for historical backfill).
 */
function mapRowToCDR(row, sourceTag, opts = {}) {
  const { includeIncomplete = false } = opts;

  if (!includeIncomplete) {
    const stoptimeVal = row.stoptime;
    const isOngoing   = stoptimeVal == null || Number(stoptimeVal) === 0;
    if (isOngoing) return null;
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

async function getCheckpoint(sourceId, tableName) {
  const SystemSetting = require('../models/SystemSetting');
  const key     = `${CHECKPOINT_KEY}_${sourceId}_${tableName}`;
  const setting = await SystemSetting.findOne({ where: { key }, raw: true });
  return setting ? toBigIntCheckpoint(setting.value) : 0n;
}

async function saveCheckpoint(sourceId, tableName, flowno) {
  const SystemSetting = require('../models/SystemSetting');
  const key = `${CHECKPOINT_KEY}_${sourceId}_${tableName}`;
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
  return Array.from({ length: daysBack }, (_, i) => getUtcTableName(-i));
}

// ─── Bulk insert helper ───────────────────────────────────────────────────────

/**
 * Deduplicates against existing DB rows, then bulk-inserts only genuinely new rows.
 *
 * Returns the count of rows actually sent to bulkCreate (pre-verified as absent).
 * ignoreDuplicates:true is kept as a last-resort race-condition guard only.
 */
async function bulkInsertCDRs(mapped, sourceTag) {
  if (!mapped.length) return 0;

  const flownos = mapped.map(c => c.flowno).filter(Boolean);
  let existingFlownos = new Set();

  if (flownos.length) {
    const existingRows = await CDR.findAll({
      attributes: ['flowno'],
      where:      { source_file: sourceTag, flowno: flownos },
      raw:        true,
    });
    existingFlownos = new Set(existingRows.map(r => String(r.flowno)));
  }

  const deduped = mapped.filter(
    c => c.flowno && !existingFlownos.has(String(c.flowno))
  );

  if (!deduped.length) return 0;

  for (let i = 0; i < deduped.length; i += INSERT_BATCH_SIZE) {
    const batch = deduped.slice(i, i + INSERT_BATCH_SIZE);
    await CDR.bulkCreate(batch, {
      ignoreDuplicates: true,   // safety net for race conditions only
      validate:         false,
    });
  }

  // Return deduped.length — the rows we verified don't exist before inserting.
  // bulkCreate result.length is always equal to input size on MySQL with
  // ignoreDuplicates, so it cannot be used for accurate insert counting.
  return deduped.length;
}

// ─── Core fetch function ──────────────────────────────────────────────────────

/**
 * Fetches CDRs from a single source table and inserts them locally.
 *
 * THREE PHASES every poll:
 *
 * PRE-SCAN
 *   Full table scan from flowno 0 for rows where stoptime IS NULL or = 0.
 *   Queues them into pending_cdrs (idempotent — ignoreDuplicates).
 *   Must start from 0, not the checkpoint: the completed-call checkpoint can
 *   advance past an ongoing call's flowno, so starting from the checkpoint
 *   would permanently miss older ongoing calls.
 *
 * PHASE A
 *   Fetch all rows with stoptime > 0 after the checkpoint, page by page.
 *   Cursor always advances by the last RAW row's flowno (not the last mapped
 *   flowno) so no gap is left when mapRowToCDR filters some rows out.
 *   Checkpoint is saved after every page so a crash mid-batch loses at most
 *   one page of work.
 *
 * PHASE B
 *   Re-check every flowno in pending_cdrs for this table.
 *   If stoptime is now > 0 → insert + remove from pending_cdrs.
 *   Large pending sets are chunked to stay within MySQL's max_allowed_packet.
 *   Rows still NULL/0 remain in pending and are logged.
 */
async function fetchAndInsertTable(pool, sourceId, tableName, lastFlowno, opts = {}) {
  const {
    updateCheckpoint  = true,
    includeIncomplete = false,
  } = opts;

  // ── Guard: skip silently if table doesn't exist yet ──────────────────────
  try {
    await pool.query(`SELECT 1 FROM \`${tableName}\` LIMIT 1`);
  } catch {
    return null;
  }

  const PendingCDR = require('../models/PendingCDR');
  const sourceTag  = `${sourceId}:${tableName}`;
  let   cursor     = lastFlowno;
  let   totalFetched  = 0;
  let   totalInserted = 0;

  // ══════════════════════════════════════════════════════════════════════════
  // PRE-SCAN — queue all currently-ongoing calls into pending_cdrs
  //
  // Starts from flowno 0 (not checkpoint) so ongoing calls with a flowno
  // lower than the current checkpoint are never missed.
  //
  // SELECT flowno only — lightweight even on large tables.
  // ignoreDuplicates makes repeated scans fully idempotent.
  // ══════════════════════════════════════════════════════════════════════════
  if (!includeIncomplete) {
    let pendingCursor = 0n;

    while (true) {
      let ongoingRows;
      try {
        [ongoingRows] = await pool.query(
          `SELECT flowno FROM \`${tableName}\`
           WHERE flowno > ?
             AND (stoptime IS NULL OR stoptime = 0)
           ORDER BY flowno ASC
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

      const nowMs = Date.now().toString();
      try {
        await PendingCDR.bulkCreate(
          ongoingRows.map(r => ({
            source_id:  sourceId,
            table_name: tableName,
            flowno:     r.flowno.toString(),
            first_seen: nowMs,
          })),
          { ignoreDuplicates: true }
        );
      } catch (err) {
        console.error(
          `[MySQLCDRFetcher:${sourceId}] PRE-SCAN bulkCreate error on ${tableName}:`,
          err.message
        );
      }

      console.log(
        `[MySQLCDRFetcher:${sourceId}] Queued ${ongoingRows.length} ` +
        `ongoing flowno(s) into pending_cdrs from ${tableName}`
      );

      // FIX: advance pendingCursor by last RAW row — never miss a page
      pendingCursor = BigInt(ongoingRows[ongoingRows.length - 1].flowno);
      if (ongoingRows.length < FETCH_BATCH_SIZE) break;
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE A — insert all completed rows (stoptime > 0) after the checkpoint
  //
  // KEY FIX (cursor advancement):
  //   cursor is always advanced by the last RAW row's flowno, not the last
  //   mapped row's flowno. mapRowToCDR can return null for some rows (e.g.
  //   ongoing rows that slipped through the SQL filter due to a race); if we
  //   advanced by lastMapped we would re-fetch those rows forever and never
  //   move the cursor past them.
  //
  // KEY FIX (infinite loop guard):
  //   If the last raw row's flowno is ≤ cursor (duplicate flowno in source or
  //   all rows filtered out), we force-advance by 1 so the loop always
  //   terminates.
  //
  // KEY FIX (checkpoint frequency):
  //   Checkpoint is saved after every page of FETCH_BATCH_SIZE rows.
  //   A crash mid-batch loses at most one page, not the entire catch-up run.
  // ══════════════════════════════════════════════════════════════════════════
  while (true) {
    const completionFilter = includeIncomplete
      ? ''
      : 'AND stoptime IS NOT NULL AND stoptime > 0';

    let rows;
    try {
      [rows] = await pool.query(
        `SELECT * FROM \`${tableName}\`
         WHERE flowno > ?
           ${completionFilter}
         ORDER BY flowno ASC
         LIMIT ?`,
        [cursor.toString(), FETCH_BATCH_SIZE]
      );
    } catch (err) {
      console.error(
        `[MySQLCDRFetcher:${sourceId}] PHASE A query error on ${tableName}:`,
        err.message
      );
      break;
    }

    if (!rows.length) break;

    // Map rows — some may return null (ongoing races, mapping errors)
    const mapped = rows
      .map(row => mapRowToCDR(row, sourceTag, { includeIncomplete }))
      .filter(Boolean);

    if (mapped.length) {
      const inserted = await bulkInsertCDRs(mapped, sourceTag);
      totalInserted += inserted;
    }

    totalFetched += rows.length;

    // ── Advance cursor by the last RAW row — critical fix ────────────────
    // Using lastMapped.flowno would leave a gap when mapRowToCDR filters rows.
    const lastRawFlowno = BigInt(rows[rows.length - 1].flowno);

    if (lastRawFlowno > cursor) {
      cursor = lastRawFlowno;
    } else {
      // Source has duplicate flowno values or all rows were filtered out.
      // Force-advance by 1 to prevent an infinite loop on the same page.
      console.warn(
        `[MySQLCDRFetcher:${sourceId}] Cursor stall detected at ${cursor} ` +
        `(lastRaw=${lastRawFlowno}) in ${tableName}. Force-advancing by 1.`
      );
      cursor = cursor + 1n;
    }

    // Save checkpoint after every page (not just at the end of the whole run)
    if (updateCheckpoint) {
      await saveCheckpoint(sourceId, tableName, cursor);
    }

    if (rows.length < FETCH_BATCH_SIZE) break;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE B — resolve all pending_cdrs rows for this table
  //
  // KEY FIX (IN() chunking):
  //   MySQL's max_allowed_packet limits the size of IN() queries. Large pending
  //   sets (thousands of flownos) can silently fail or truncate. We chunk the
  //   pending list into PENDING_IN_CHUNK_SIZE slices and query each chunk
  //   independently to guarantee every pending flowno is checked.
  //
  // No endreason filter — a failed call with stoptime written is resolved.
  // bulkInsertCDRs pre-check prevents duplicates even if Phase A already
  // inserted the row in the same poll cycle.
  // ══════════════════════════════════════════════════════════════════════════
  const pendingRows = await PendingCDR.findAll({
    where: { source_id: sourceId, table_name: tableName },
    raw:   true,
  });

  if (pendingRows.length) {
    const pendingFlownos = pendingRows.map(p => p.flowno);
    let   nowResolved    = [];

    // Chunk the IN() query to avoid max_allowed_packet limits
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
        // Continue with remaining chunks — don't abort the entire phase
      }
    }

    if (nowResolved.length) {
      const mapped = nowResolved
        .map(row => mapRowToCDR(row, sourceTag, { includeIncomplete: false }))
        .filter(Boolean);

      if (mapped.length) {
        const recovered = await bulkInsertCDRs(mapped, sourceTag);
        totalInserted += recovered;
        if (recovered > 0) {
          console.log(
            `[MySQLCDRFetcher:${sourceId}] Recovered ${recovered} ` +
            `previously-pending CDR(s) from ${tableName}`
          );
        }
      }

      const resolvedFlownos = nowResolved.map(r => r.flowno.toString());

      // Chunk the destroy call as well for safety with large sets
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
        `resolved flowno(s) from pending_cdrs`
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

  return { fetched: totalFetched, inserted: totalInserted, maxFlowno: cursor };
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
    const tables    = getRecentTableNames(LIVE_POLL_DAYS_BACK);

    let totalFetched  = 0;
    let totalInserted = 0;

    for (const tableName of tables) {
      const checkpoint = await getCheckpoint(this.sourceId, tableName);
      const result     = await fetchAndInsertTable(
        this.pool, this.sourceId, tableName, checkpoint
      );
      if (!result) continue;
      totalFetched  += result.fetched;
      totalInserted += result.inserted;
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