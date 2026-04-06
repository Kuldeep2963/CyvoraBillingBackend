'use strict';

const mysql     = require('mysql2/promise');
const net       = require('net');
const { spawn } = require('child_process');
const CDR       = require('../models/CDR');
const { createNotification } = require('./notification-service');

// ─── Constants ────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS        = 60_000;   // poll every 60 seconds
const FETCH_BATCH_SIZE        = 500;      // rows fetched per query
const INSERT_BATCH_SIZE       = 500;      // rows per bulkCreate call
const STARTUP_DELAY_MS        = 20_000;   // wait for app to fully boot
const MIN_POLL_GAP_MS         = 30_000;   // debounce guard
const SSH_TUNNEL_RESTART_DELAY= 5_000;   // wait before restarting dead SSH tunnel
const CHECKPOINT_KEY          = 'mysql_cdr_last_flowno';

// ─── How many past days the live poller checks ─────────────────────────────────
// 2 = today + yesterday. Protects against midnight boundary data loss.
// The live poller intentionally stays lightweight (not all history).
const LIVE_POLL_DAYS_BACK     = 2;

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

// ─── Column mapping: source → CDR model ──────────────────────────────────────

/**
 * Maps a raw row from e_cdr_YYYYMMDD to your CDR model fields.
 * Returns null if the row should be skipped.
 */
function mapRowToCDR(row, sourceTag, opts = {}) {
  const { includeIncomplete = false } = opts;

  // Live poller keeps completed-call filtering; backfill can opt out.
  if (!includeIncomplete && (!row.stoptime || row.stoptime <= row.starttime)) {
    return null;
  }

  return {
    // Identity
    flowno:               row.flowno?.toString()           ?? null,
    softswitchcallid:     row.softswitchcallid?.toString() ?? null,
    callercallid:         row.callercallid                 ?? null,
    calleroriginalcallid: row.calleroriginalcallid         ?? null,

    // Caller info
    callere164:           row.callere164                   ?? null,
    calleraccesse164:     row.calleraccesse164             ?? null,
    callerip:             row.callerip                     ?? null,
    callercodec:          row.callercodec                  ?? null,
    callergatewayid:      row.callergatewayid              ?? null,
    callerproductid:      row.callerproductid              ?? null,
    callertogatewaye164:  row.callertogatewaye164          ?? null,
    callertype:           row.callertype                   ?? null,
    callerareacode:       row.callerareacode               ?? null,

    // Callee info
    calleee164:           row.calleee164                   ?? null,
    calleeaccesse164:     row.calleeaccesse164             ?? null,
    calleeip:             row.calleeip                     ?? null,
    calleecodec:          row.calleecodec                  ?? null,
    calleegatewayid:      row.calleegatewayid              ?? null,
    calleeproductid:      row.calleeproductid              ?? null,
    calleetogatewaye164:  row.calleetogatewaye164          ?? null,
    calleetype:           row.calleetype                   ?? null,
    calleeareacode:       row.calleeareacode               ?? null,

    // Timing (already in ms)
    starttime:            row.starttime?.toString()        ?? null,
    stoptime:             row.stoptime?.toString()         ?? null,
    feetime:              row.feetime                      ?? 0,
    agentfeetime:         row.agentfeetime                 ?? 0,
    suitefeetime:         row.suitefeetime                 ?? 0,
    agentsuitefeetime:    row.agentsuitefeetime            ?? 0,
    holdtime:             row.holdtime                     ?? 0,
    callerpdd:            row.callerpdd                    ?? 0,
    calleepdd:            row.calleepdd                    ?? 0,

    // Billing
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

    // Customer
    customeraccount:      row.customeraccount              ?? null,
    customername:         row.customername                 ?? null,
    agentaccount:         row.agentaccount                 ?? null,
    agentname:            row.agentname                    ?? null,
    agentcdr_id:          row.agentcdr_id                  ?? null,

    // Call result
    enddirection:         row.enddirection                 ?? null,
    endreason:            row.endreason                    ?? null,
    rtpforward:           row.rtpforward                   ?? 0,
    softswitchname:       row.softswitchname               ?? null,

    // Source tracking — tells you which server this CDR came from
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

    // Handle JSON-stringified checkpoint values like '"204"'.
    try {
      return toBigIntCheckpoint(JSON.parse(trimmed));
    } catch {
      // Keep parsing below.
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
    if (value.flowno  != null) return toBigIntCheckpoint(value.flowno);
    if (value.value   != null) return toBigIntCheckpoint(value.value);
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
  await SystemSetting.upsert({
    key,
    value: { flowno: flowno.toString() },
  });
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

/** Returns table names for today and N-1 days back, newest first. */
function getRecentTableNames(daysBack = LIVE_POLL_DAYS_BACK) {
  return Array.from({ length: daysBack }, (_, i) => getUtcTableName(-i));
}

// ─── Shared table fetch logic (used by both live poller & backfill) ───────────

/**
 * Fetches new CDRs from a single table after `lastFlowno`,
 * inserts them, and returns stats + the new max flowno.
 *
 * Uses paginated fetching so large tables (>500 rows) are fully consumed
 * in a single call rather than waiting for the next poll interval.
 *
 * @param {object} pool         - mysql2 pool
 * @param {string} sourceId     - e.g. 'company_b'
 * @param {string} tableName    - e.g. 'e_cdr_20260325'
 * @param {bigint} lastFlowno   - checkpoint to resume from
 * @param {object} [opts]
 * @param {boolean} [opts.updateCheckpoint=true] - save checkpoint after insert
 * @param {boolean} [opts.includeIncomplete=false] - include rows with stoptime <= starttime
 * @returns {{ fetched: number, inserted: number, maxFlowno: bigint } | null}
 */
async function fetchAndInsertTable(pool, sourceId, tableName, lastFlowno, opts = {}) {
  const {
    updateCheckpoint = true,
    includeIncomplete = false,
  } = opts;

  // ── 1. Check table exists ──────────────────────────────────────────────────
  try {
    await pool.query(`SELECT 1 FROM \`${tableName}\` LIMIT 1`);
  } catch {
    return null; // table doesn't exist yet
  }

  const sourceTag    = `${sourceId}:${tableName}`;
  let   cursor       = lastFlowno;
  let   totalFetched = 0;
  let   totalInserted= 0;

  // ── 2. Paginate through all new rows ──────────────────────────────────────
  // FIX: original code fetched only one batch of 500 per poll, leaving
  // the rest for the next tick. We now loop until the table is drained.
  // This is safe because `updateCheckpoint` is true, so we resume correctly
  // even if the process crashes mid-way.
  while (true) {
    const completionFilterSql = includeIncomplete ? '' : 'AND stoptime > starttime';
    const [rows] = await pool.query(
      `SELECT * FROM \`${tableName}\`
       WHERE flowno > ?
         ${completionFilterSql}
       ORDER BY flowno ASC
       LIMIT ?`,
      [cursor.toString(), FETCH_BATCH_SIZE]
    );

    if (!rows.length) break;

    // Map + filter invalid rows
    const mapped = rows
      .map(row => mapRowToCDR(row, sourceTag, { includeIncomplete }))
      .filter(Boolean);

    if (mapped.length) {
      // ── 3. Deduplicate against existing records ──────────────────────────
      const flownos = mapped.map(cdr => cdr.flowno).filter(Boolean);
      let existingFlownos = new Set();

      if (flownos.length) {
        const existingRows = await CDR.findAll({
          attributes: ['flowno'],
          where: { source_file: sourceTag, flowno: flownos },
          raw: true,
        });
        existingFlownos = new Set(existingRows.map(r => String(r.flowno)));
      }

      const deduped = mapped.filter(cdr => cdr.flowno && !existingFlownos.has(String(cdr.flowno)));

      // ── 4. Bulk insert in batches ────────────────────────────────────────
      for (let i = 0; i < deduped.length; i += INSERT_BATCH_SIZE) {
        const batch  = deduped.slice(i, i + INSERT_BATCH_SIZE);
        const result = await CDR.bulkCreate(batch, {
          ignoreDuplicates: true,
          validate:         false,
        });
        totalInserted += result.length;
      }
    }

    totalFetched += rows.length;

    // ── 5. Advance cursor & save checkpoint after every page ───────────
    // CRITICAL FIX: cursor must always advance to the last flowno of the fetched
    // batch regardless of how many were inserted. This is safe because:
    //   (a) The SQL filter `stoptime > starttime` already excludes in-progress calls.
    //   (b) `ignoreDuplicates: true` on bulkCreate makes re-processing idempotent.
    //   (c) The backfill's `--ignore-checkpoints` flag handles the case where the
    //       live poller advanced the checkpoint before the backfill ran.
    //
    // NOT advancing here would cause an infinite loop: if every row in a batch is
    // filtered by mapRowToCDR (e.g. all have null stoptime in source), cursor stays
    // at lastFlowno and the same batch is fetched forever.
    cursor = BigInt(rows[rows.length - 1].flowno);

    if (updateCheckpoint && cursor > lastFlowno) {
      await saveCheckpoint(sourceId, tableName, cursor);
    }

    // If we got fewer rows than the batch limit we've reached the end
    if (rows.length < FETCH_BATCH_SIZE) break;
  }

  return { fetched: totalFetched, inserted: totalInserted, maxFlowno: cursor };
}

// ─── Service ──────────────────────────────────────────────────────────────────

class MySQLCDRFetcher {
  /**
   * @param {object} config
   * @param {string} config.host
   * @param {number} config.port
   * @param {string} config.user
   * @param {string} config.password
   * @param {string} config.database
   * @param {string} config.sourceId   — unique identifier e.g. 'company_b'
   */
  constructor(config = {}) {
    const hasSshEnv = Boolean(
      !isEmptyEnv(process.env.SERVER_IP) &&
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

    this.config    = { ...envConfig, ...config };
    this.sourceId  = this.config.sourceId;
    this.pool      = null;
    this.started   = false;
    this.running   = false;
    this.lastRunAt = 0;
    this._interval         = null;
    this._sshTunnelProcess = null;

    this._onProcessExit = () => {
      if (this._sshTunnelProcess) {
        this._sshTunnelProcess.kill('SIGTERM');
        this._sshTunnelProcess = null;
      }
    };

    process.on('exit',   this._onProcessExit);
    process.on('SIGINT', this._onProcessExit);
    process.on('SIGTERM',this._onProcessExit);

    this.start().catch((err) => {
      console.error(`[MySQLCDRFetcher:${this.sourceId}] Failed to start:`, err.message);
    });
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  async start() {
    if (this.started) return;

    const required = ['user', 'database'];
    if (!this.config.useSshTunnel) required.unshift('host');
    const missing = required.filter((key) => !this.config[key]);
    if (missing.length) {
      console.warn(`[MySQLCDRFetcher:${this.sourceId}] Disabled - missing config: ${missing.join(', ')}`);
      return;
    }

    this.started = true;

    const dbAddr = this.config.useSshTunnel
      ? `127.0.0.1:${this.config.tunnelLocalPort}`
      : `${this.config.host}:${this.config.port}`;

    console.log(
      `[MySQLCDRFetcher:${this.sourceId}] Connection mode=${this.config.useSshTunnel ? 'ssh-tunnel' : 'direct'} ` +
      `db=${this.config.database} mysql=${dbAddr}`
    );

    if (this.config.useSshTunnel) {
      await this._startSshTunnel();
    }

    this.pool = mysql.createPool({
      host:               this.config.useSshTunnel ? '127.0.0.1' : this.config.host,
      port:               this.config.useSshTunnel ? this.config.tunnelLocalPort : (this.config.port || 3306),
      user:               this.config.user,
      password:           this.config.password,
      database:           this.config.database,
      waitForConnections: true,
      connectionLimit:    3,
      queueLimit:         10,
      connectTimeout:     10_000,
      multipleStatements: false,
    });

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

    console.log(`[MySQLCDRFetcher:${this.sourceId}] Fetcher started — polling every ${POLL_INTERVAL_MS / 1000}s`);
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
    process.off('exit',   this._onProcessExit);
    process.off('SIGINT', this._onProcessExit);
    process.off('SIGTERM',this._onProcessExit);
    this.started = false;
    console.log(`[MySQLCDRFetcher:${this.sourceId}] Fetcher stopped`);
  }

  // ── SSH Tunnel ─────────────────────────────────────────────────────────────

  async _canConnectLocalPort(port) {
    return new Promise((resolve) => {
      const socket = net.createConnection({ host: '127.0.0.1', port });
      socket.once('connect', () => { socket.destroy(); resolve(true);  });
      socket.once('error',   () => { socket.destroy(); resolve(false); });
    });
  }

  async _startSshTunnel() {
    if (this._sshTunnelProcess) return;

    const portInUse = await this._canConnectLocalPort(this.config.tunnelLocalPort);
    if (portInUse) {
      console.log(
        `[MySQLCDRFetcher:${this.sourceId}] Reusing existing local tunnel on localhost:${this.config.tunnelLocalPort}`
      );
      return;
    }

    const required = ['sshHost', 'sshUser', 'sshPort', 'sshKeyPath'];
    const missing  = required.filter((key) => !this.config[key]);
    if (missing.length) throw new Error(`SSH tunnel enabled but missing config: ${missing.join(', ')}`);

    const args = [
      '-N',
      '-L', `${this.config.tunnelLocalPort}:${this.config.tunnelRemoteHost}:${this.config.tunnelRemotePort}`,
      '-i', this.config.sshKeyPath,
      '-p', String(this.config.sshPort),
      '-o', 'BatchMode=yes',
      '-o', 'ExitOnForwardFailure=yes',
      '-o', 'StrictHostKeyChecking=no',
      '-o', 'ServerAliveInterval=30',   // FIX: keep tunnel alive
      '-o', 'ServerAliveCountMax=3',    // FIX: restart if 3 keepalives fail
      `${this.config.sshUser}@${this.config.sshHost}`,
    ];

    const spawnTunnel = () => {
      this._sshTunnelProcess = spawn('ssh', args, {
        stdio: ['ignore', 'ignore', 'pipe'],
      });

      this._sshTunnelProcess.stderr.on('data', (chunk) => {
        const msg = String(chunk || '').trim();
        if (msg) console.error(`[MySQLCDRFetcher:${this.sourceId}] SSH tunnel: ${msg}`);
      });

      // FIX: auto-restart SSH tunnel if it dies unexpectedly
      this._sshTunnelProcess.once('exit', (code) => {
        this._sshTunnelProcess = null;
        if (this.started) {
          console.warn(
            `[MySQLCDRFetcher:${this.sourceId}] SSH tunnel exited (code=${code}), ` +
            `restarting in ${SSH_TUNNEL_RESTART_DELAY / 1000}s...`
          );
          setTimeout(spawnTunnel, SSH_TUNNEL_RESTART_DELAY);
        }
      });
    };

    spawnTunnel();

    // Wait for the local port to become available
    await new Promise((resolve, reject) => {
      const startedAt = Date.now();
      const tryConnect = () => {
        const socket = net.createConnection({ host: '127.0.0.1', port: this.config.tunnelLocalPort });
        socket.once('connect', () => { socket.destroy(); resolve(); });
        socket.once('error',   () => {
          socket.destroy();
          if (Date.now() - startedAt > 25_000) {
            reject(new Error(
              `SSH tunnel did not open port ${this.config.tunnelLocalPort} within 25s. ` +
              `Check SSH_KEY_PATH, SERVER_IP, SSH_USERNAME, SSH_PORT, and firewall.`
            ));
            return;
          }
          setTimeout(tryConnect, 250);
        });
      };
      tryConnect();
    });

    console.log(`[MySQLCDRFetcher:${this.sourceId}] SSH tunnel ready on localhost:${this.config.tunnelLocalPort}`);
  }

  // ── Poll ───────────────────────────────────────────────────────────────────

  async _poll() {
    const now = Date.now();
    if (this.running) {
      console.warn(`[MySQLCDRFetcher:${this.sourceId}] Skipped — previous poll still running`);
      return;
    }
    if (this.lastRunAt && (now - this.lastRunAt) < MIN_POLL_GAP_MS) return;

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

  // ── Core fetch logic ───────────────────────────────────────────────────────

  async _fetchAndInsert() {
    const startedAt = Date.now();

    // FIX: poll today + yesterday to handle midnight boundary.
    // If a call started at 23:59 and ended at 00:01 it lands in today's table,
    // but any calls that finished in the last seconds of yesterday also need
    // re-checking until the checkpoint for yesterday's table is fully caught up.
    const tables = getRecentTableNames(LIVE_POLL_DAYS_BACK);

    let totalFetched  = 0;
    let totalInserted = 0;

    for (const tableName of tables) {
      const checkpoint = await getCheckpoint(this.sourceId, tableName);
      const result     = await fetchAndInsertTable(this.pool, this.sourceId, tableName, checkpoint);
      if (!result) continue;

      totalFetched  += result.fetched;
      totalInserted += result.inserted;
    }

    if (totalFetched > 0) {
      const durationMs = Date.now() - startedAt;
      console.log(
        `[MySQLCDRFetcher:${this.sourceId}] Fetched ${totalFetched} rows, ` +
        `inserted ${totalInserted} in ${durationMs}ms`
      );
      if (totalInserted > 0) {
        await createNotification({
          title:    'CDR sync complete',
          message:  `${totalInserted} new CDR(s) imported from ${this.sourceId}`,
          type:     'info',
          category: 'cdr-sync',
          metadata: { totalFetched, totalInserted, sourceId: this.sourceId, durationMs },
        }).catch(err =>
          console.error(`[MySQLCDRFetcher:${this.sourceId}] Notification error:`, err)
        );
      }
    } else {
      console.log(`[MySQLCDRFetcher:${this.sourceId}] No new rows in ${tables.join(', ')}`);
    }
  }
}

module.exports = { MySQLCDRFetcher, fetchAndInsertTable };