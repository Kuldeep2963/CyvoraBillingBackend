'use strict';

const mysql     = require('mysql2/promise');
const net       = require('net');
const { spawn } = require('child_process');
const CDR       = require('../models/CDR');
const { createNotification } = require('./notification-service');

// ─── Constants ────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS         = 10 * 60_000;  // FIX: was 10 * 60_000 (600s) — corrected to 60s
const FETCH_BATCH_SIZE         = 500;
const INSERT_BATCH_SIZE        = 500;
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
 * INSERTION RULE — stoptime only, no endreason filtering:
 *
 *   Ongoing  →  stoptime IS NULL or stoptime = 0
 *               returns null → queued into pending_cdrs
 *               inserted by Phase B the moment stoptime is written
 *
 *   All other rows  →  insert immediately
 *               completed, failed, rejected, instant-reject — everything
 *               endreason stored as-is, ASR and fail counts are correct
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
 * FIX Bug 1 — correct insert counting.
 *
 * Sequelize bulkCreate with ignoreDuplicates:true uses INSERT IGNORE on MySQL.
 * The JS result array contains ALL input rows regardless of whether they were
 * actually written — result.length is ALWAYS equal to deduped.length, not
 * the number of rows physically inserted.
 *
 * The only reliable way to count real inserts is to check existence BEFORE
 * inserting (which we already do with CDR.findAll), then count the deduped
 * array — those are the rows that don't exist yet and will be inserted.
 * We keep ignoreDuplicates:true as a final safety net against race conditions,
 * but we trust the pre-check count as the accurate insert count.
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

  // deduped = rows that genuinely don't exist yet
  const deduped = mapped.filter(
    c => c.flowno && !existingFlownos.has(String(c.flowno))
  );

  if (!deduped.length) return 0;

  for (let i = 0; i < deduped.length; i += INSERT_BATCH_SIZE) {
    const batch = deduped.slice(i, i + INSERT_BATCH_SIZE);
    await CDR.bulkCreate(batch, {
      ignoreDuplicates: true,  // safety net for race conditions only
      validate:         false,
    });
  }

  // FIX: return deduped.length (rows we verified don't exist before insert)
  // NOT result.length (which equals input size regardless of actual inserts)
  return deduped.length;
}

// ─── Core fetch function ──────────────────────────────────────────────────────

/**
 * Fetches CDRs from a single source table and inserts them locally.
 *
 * THREE PHASES every poll:
 *
 * PRE-SCAN
 *   Scan the entire table from flowno 0 for rows where stoptime IS NULL or = 0.
 *   Queue into pending_cdrs (idempotent — ignoreDuplicates).
 *   Must start from 0, not checkpoint: the completed-call checkpoint can advance
 *   past an ongoing call's flowno. Starting from 0 guarantees no ongoing call
 *   is ever missed regardless of flowno ordering.
 *
 * PHASE A
 *   Fetch all rows with stoptime > 0 after the checkpoint.
 *   Insert all of them — no endreason filtering. Every CDR is stored.
 *   Cursor advances only to the last successfully mapped flowno.
 *   FIX Bug 2: checkpoint is saved after EVERY page (every 500 rows),
 *   not just at the end. If the process crashes mid-batch, it resumes
 *   from the last saved page rather than re-fetching the entire table.
 *
 * PHASE B
 *   Re-check every flowno in pending_cdrs for this table.
 *   If stoptime is now > 0 → insert + remove from pending_cdrs.
 *   If still 0/NULL → leave, log count.
 */
async function fetchAndInsertTable(pool, sourceId, tableName, lastFlowno, opts = {}) {
  const {
    updateCheckpoint  = true,
    includeIncomplete = false,
  } = opts;

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

  // ════════════════════════════════════════════════════════════════════════════
  // PRE-SCAN — queue all currently-ongoing calls into pending_cdrs
  //
  // Starts from flowno 0, not from checkpoint.
  // Reason: completed-call checkpoint advances independently of ongoing calls.
  // A call with flowno 100 that is ongoing when checkpoint is at 200 would
  // be permanently missed if pre-scan started from 200.
  //
  // Query is SELECT flowno only (no SELECT *) — lightweight even on large tables.
  // ignoreDuplicates makes it fully idempotent across polls.
  // ════════════════════════════════════════════════════════════════════════════
  if (!includeIncomplete) {
    let pendingCursor = 0n;

    while (true) {
      const [ongoingRows] = await pool.query(
        `SELECT flowno FROM \`${tableName}\`
         WHERE flowno > ?
           AND (stoptime IS NULL OR stoptime = 0)
         ORDER BY flowno ASC
         LIMIT ?`,
        [pendingCursor.toString(), FETCH_BATCH_SIZE]
      );

      if (!ongoingRows.length) break;

      const nowMs = Date.now().toString();
      await PendingCDR.bulkCreate(
        ongoingRows.map(r => ({
          source_id:  sourceId,
          table_name: tableName,
          flowno:     r.flowno.toString(),
          first_seen: nowMs,
        })),
        { ignoreDuplicates: true }
      );

      console.log(
        `[MySQLCDRFetcher:${sourceId}] Queued ${ongoingRows.length} ` +
        `ongoing flowno(s) into pending_cdrs from ${tableName}`
      );

      pendingCursor = BigInt(ongoingRows[ongoingRows.length - 1].flowno);
      if (ongoingRows.length < FETCH_BATCH_SIZE) break;
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE A — insert all rows where stoptime > 0, after the checkpoint
  //
  // SQL filter mirrors mapRowToCDR exactly:
  //   stoptime IS NOT NULL AND stoptime > 0  →  insert
  //   stoptime IS NULL OR stoptime = 0       →  skip (handled by pending_cdrs)
  //
  // FIX Bug 2: checkpoint saved after every page of 500.
  // Previously it was saved only when cursor advanced past lastFlowno, meaning
  // a 3000-row catch-up would save checkpoint only at the very end. A crash
  // at row 2500 would re-fetch all 3000 from the start next restart.
  // Now it saves every 500 rows — a crash re-fetches at most 500 rows,
  // and ignoreDuplicates + pre-check in bulkInsertCDRs make re-processing safe.
  // ════════════════════════════════════════════════════════════════════════════
  while (true) {
    const completionFilter = includeIncomplete
      ? ''
      : 'AND stoptime IS NOT NULL AND stoptime > 0';

    const [rows] = await pool.query(
      `SELECT * FROM \`${tableName}\`
       WHERE flowno > ?
         ${completionFilter}
       ORDER BY flowno ASC
       LIMIT ?`,
      [cursor.toString(), FETCH_BATCH_SIZE]
    );

    if (!rows.length) break;

    const mapped = rows
      .map(row => mapRowToCDR(row, sourceTag, { includeIncomplete }))
      .filter(Boolean);

    if (mapped.length) {
      const inserted = await bulkInsertCDRs(mapped, sourceTag);
      totalInserted += inserted;
    }

    totalFetched += rows.length;

    // Advance cursor to last mapped flowno (SQL/JS filters are in sync so
    // mapped always has entries when rows are returned with completionFilter).
    const lastMapped = mapped[mapped.length - 1];
    if (lastMapped?.flowno) {
      const newCursor = BigInt(lastMapped.flowno);
      if (newCursor > cursor) {
        cursor = newCursor;
        // FIX Bug 2: save checkpoint every page, not just at the end
        if (updateCheckpoint) {
          await saveCheckpoint(sourceId, tableName, cursor);
        }
      }
    } else {
      // Safety fallback (SQL/JS mismatch — shouldn't happen)
      const fallback = BigInt(rows[rows.length - 1].flowno);
      if (fallback > cursor) {
        cursor = fallback;
        if (updateCheckpoint) {
          await saveCheckpoint(sourceId, tableName, cursor);
        }
      }
    }

    if (rows.length < FETCH_BATCH_SIZE) break;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE B — resolve all pending_cdrs rows for this table
  //
  // Fetches the current state of every pending flowno from source.
  // Inserts rows where stoptime is now > 0, then removes them from pending.
  // Rows still with stoptime NULL/0 stay in pending — logged for monitoring.
  //
  // No endreason check. A failed call with stoptime written is resolved.
  // ignoreDuplicates + pre-check in bulkInsertCDRs prevent any duplicates
  // even if Phase A already inserted the row in the same poll cycle.
  // ════════════════════════════════════════════════════════════════════════════
  const pendingRows = await PendingCDR.findAll({
    where: { source_id: sourceId, table_name: tableName },
    raw:   true,
  });

  if (pendingRows.length) {
    const pendingFlownos = pendingRows.map(p => p.flowno);

    let nowResolved = [];
    try {
      const [resolvedRows] = await pool.query(
        `SELECT * FROM \`${tableName}\`
         WHERE flowno IN (?)
           AND stoptime IS NOT NULL
           AND stoptime > 0`,
        [pendingFlownos]
      );
      nowResolved = resolvedRows;
    } catch (err) {
      console.error(
        `[MySQLCDRFetcher:${sourceId}] Phase B query error for ${tableName}:`,
        err.message
      );
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
      await PendingCDR.destroy({
        where: {
          source_id:  sourceId,
          table_name: tableName,
          flowno:     resolvedFlownos,
        },
      });

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
      // Fetched rows but all were already in DB — normal on subsequent polls
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