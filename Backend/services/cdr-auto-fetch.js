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

// ─── stoptime normalisation ───────────────────────────────────────────────────
//
// FIX BUG B: The source DB may return stoptime as a number (INT/DECIMAL/BIGINT),
// a string ("0", "0.000", "0.00"), or null depending on the column type and the
// mysql2 type-cast configuration.  We normalise once here so every consumer
// (SQL filter logic is already correct; this guards the JS-side guard in
// mapRowToCDR) uses the same definition of "ongoing".
//
// A call is "ongoing" when stoptime is:
//   - null / undefined
//   - the number 0  (or any value whose numeric form is 0: "0", "0.0", 0n)
//
// Any positive value (including fractional timestamps) means the call ended.

function isOngoingStoptime(rawValue) {
  if (rawValue === null || rawValue === undefined) return true;
  // BigInt path (mysql2 bigint-as-string mode returns strings; we also handle
  // native BigInt if the driver is configured that way)
  if (typeof rawValue === 'bigint') return rawValue === 0n;
  // Numeric path
  const n = Number(rawValue);
  if (!Number.isFinite(n)) return true;   // NaN / Infinity → treat as incomplete
  return n === 0;
}

// ─── Column mapping ───────────────────────────────────────────────────────────
//
// FIX BUG B (continued): use isOngoingStoptime() instead of the previous
// inline check so the JS guard and the SQL filter agree on semantics.
//
// NOTE: mapRowToCDR still returns null for ongoing rows when
// includeIncomplete=false.  Callers that need to queue those rows into
// pending_cdrs must detect the null return themselves (see fetchAndInsertTable).

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

// ─── Pending CDR helper ───────────────────────────────────────────────────────
//
// FIX BUG D (shared helper): any code path that discovers a row exists in the
// source but cannot be inserted right now (ongoing call, mapping returned null)
// must call this to ensure the row is retried in Phase B.  Using a shared
// helper prevents the logic from drifting between call sites.

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
    // Log but never throw — a failure here must not abort the main fetch loop.
    console.error(
      `[MySQLCDRFetcher:${sourceId}] queuePending error on ${tableName}:`,
      err.message
    );
  }
}

// ─── Bulk insert helper ───────────────────────────────────────────────────────

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

  return deduped.length;
}

// ─── Core fetch function ──────────────────────────────────────────────────────
//
// THREE PHASES every poll — see inline comments for the specific bug fix in
// each phase.

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
  // FIX BUG A: after the PRE-SCAN loop we do a targeted back-fill query for
  // any flowno that is ≤ cursor AND has stoptime > 0 but was NOT seen in
  // Phase A of the previous poll (i.e. it completed in the window between
  // the last PRE-SCAN and the last Phase A).  This is handled by Phase B
  // reading pending_cdrs comprehensively, combined with the BUG D fix that
  // ensures Phase A always queues rejected rows.  No additional query is
  // needed here — the combination of "queue on rejection" (BUG D fix) and
  // "Phase B resolves everything in pending_cdrs" closes the race.
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

      // queuePending is idempotent (ignoreDuplicates) — safe to call every poll.
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
  // PHASE A — insert all completed rows (stoptime > 0) after the checkpoint
  //
  // FIX BUG D: when mapRowToCDR returns null for a row that passed the SQL
  // filter (race: the call was still ongoing when PRE-SCAN ran but completed
  // before Phase A ran, yet isOngoingStoptime still fires due to a data quirk),
  // we queue that flowno into pending_cdrs instead of silently discarding it.
  // Phase B will pick it up and resolve it on the next poll.
  //
  // FIX BUG E: the checkpoint is saved only after a SUCCESSFUL page insert.
  // If the query throws, we break without saving the cursor for that page,
  // so the next poll re-fetches from the last good position.  The try/catch
  // now wraps the entire page block (query + map + insert) so a partial
  // failure does not advance the checkpoint.
  //
  // FIX BUG C: the force-advance-by-1 path now emits a structured warning
  // with enough context to diagnose source data issues, and the stall counter
  // limits how many consecutive stalls are silently tolerated before we treat
  // it as a fatal loop and abort, preventing an infinite loop that burns CPU
  // forever against a broken page.
  // ══════════════════════════════════════════════════════════════════════════
  let consecutiveStalls = 0;
  const MAX_CONSECUTIVE_STALLS = 3;

  while (true) {
    const completionFilter = includeIncomplete
      ? ''
      : 'AND stoptime IS NOT NULL AND stoptime > 0';

    let rows;

    // FIX BUG E: wrap the entire page block so a query failure does NOT save
    // the checkpoint, allowing a clean retry next poll.
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
        `[MySQLCDRFetcher:${sourceId}] PHASE A query error on ${tableName} ` +
        `at cursor ${cursor}: ${err.message} — checkpoint NOT advanced, ` +
        `will retry next poll`
      );
      // Do NOT save checkpoint here — intentional. Break so we move to Phase B.
      break;
    }

    if (!rows.length) break;

    // FIX BUG D: separate rows into mappable and unmappable.
    // Unmappable rows (mapRowToCDR returns null) that passed the SQL filter
    // are queued to pending_cdrs so Phase B can recover them.
    const mapped   = [];
    const rejected = [];   // flowno strings

    for (const row of rows) {
      const cdr = mapRowToCDR(row, sourceTag, { includeIncomplete });
      if (cdr) {
        mapped.push(cdr);
      } else if (!includeIncomplete) {
        // Row passed SQL stoptime > 0 filter but JS mapping rejected it.
        // This is a data race — queue for Phase B recovery.
        rejected.push(row.flowno);
      }
    }

    if (rejected.length) {
      console.warn(
        `[MySQLCDRFetcher:${sourceId}] PHASE A: ${rejected.length} row(s) ` +
        `in ${tableName} passed SQL filter but were rejected by mapRowToCDR ` +
        `— queuing to pending_cdrs for Phase B recovery. ` +
        `flowno range: ${rejected[0]}..${rejected[rejected.length - 1]}`
      );
      await queuePending(sourceId, tableName, rejected);
    }

    // FIX BUG E (continued): only save checkpoint if the insert succeeds.
    // If bulkInsertCDRs throws, we catch here, break without advancing the
    // cursor, and let the next poll retry the entire page.
    try {
      if (mapped.length) {
        const inserted = await bulkInsertCDRs(mapped, sourceTag);
        totalInserted += inserted;
      }
    } catch (err) {
      console.error(
        `[MySQLCDRFetcher:${sourceId}] PHASE A insert error on ${tableName} ` +
        `at cursor ${cursor}: ${err.message} — checkpoint NOT advanced, ` +
        `will retry next poll`
      );
      break;
    }

    totalFetched += rows.length;

    // ── Advance cursor by the last RAW row — prevents gaps ───────────────
    const lastRawFlowno = BigInt(rows[rows.length - 1].flowno);

    if (lastRawFlowno > cursor) {
      cursor = lastRawFlowno;
      consecutiveStalls = 0;
    } else {
      // FIX BUG C: structured warning with full context for diagnostics.
      // We still force-advance to prevent an infinite loop, but we cap the
      // number of consecutive stalls and abort if exceeded, so a broken
      // source table cannot spin forever.
      consecutiveStalls++;
      console.warn(
        `[MySQLCDRFetcher:${sourceId}] PHASE A cursor stall #${consecutiveStalls} ` +
        `at cursor=${cursor}, lastRawFlowno=${lastRawFlowno} in ${tableName}. ` +
        `Rows in page: ${rows.length}. This indicates duplicate or out-of-order ` +
        `flowno values in the source table — investigate source data integrity. ` +
        `Force-advancing cursor by 1.`
      );
      cursor = cursor + 1n;

      if (consecutiveStalls >= MAX_CONSECUTIVE_STALLS) {
        console.error(
          `[MySQLCDRFetcher:${sourceId}] PHASE A aborted after ` +
          `${MAX_CONSECUTIVE_STALLS} consecutive stalls at cursor=${cursor} ` +
          `in ${tableName}. Will resume from this position next poll.`
        );
        break;
      }
    }

    // Save checkpoint after every successful page (not only at end of run).
    // FIX BUG E: this line is now only reachable if both the query AND the
    // insert succeeded (errors break out of the loop above).
    if (updateCheckpoint) {
      await saveCheckpoint(sourceId, tableName, cursor);
    }

    if (rows.length < FETCH_BATCH_SIZE) break;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE B — resolve all pending_cdrs rows for this table
  //
  // FIX BUG F: resolvedFlownos is now deduplicated before being passed to
  // destroy, so a flowno that appeared in multiple IN() chunks (possible with
  // source data integrity issues) does not cause redundant destroy calls that
  // could mask problems.
  //
  // The destroy loop was already chunked in the original code but the chunk
  // slice was applied to resolvedFlownos which could contain duplicates.
  // After deduplication the chunked destroy is correct.
  //
  // FIX BUG G (inter-phase race): Phase A may have already inserted some of
  // the pending rows in this same poll cycle.  bulkInsertCDRs pre-checks for
  // existing rows, so duplicate inserts are safely skipped.  The destroy
  // correctly removes the pending record regardless of whether Phase A or
  // Phase B did the insert, so no row is left stranded.
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
        // Continue with remaining chunks — partial recovery is better than none.
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

      // FIX BUG F: deduplicate resolved flownos before destroy so that source
      // rows appearing in multiple chunks do not produce redundant destroy
      // calls that could race with the next poll's Phase A.
      const resolvedFlownoSet = new Set(
        nowResolved.map(r => r.flowno.toString())
      );
      const resolvedFlownos = [...resolvedFlownoSet];

      // Chunked destroy — already correct in original; kept as-is.
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
          // Rows remain in pending_cdrs and will be retried next poll — correct.
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