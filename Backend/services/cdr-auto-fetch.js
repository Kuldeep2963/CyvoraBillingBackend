'use strict';

const mysql     = require('mysql2/promise');
const net       = require('net');
const { spawn } = require('child_process');
const CDR       = require('../models/CDR');
const { createNotification } = require('./notification-service');

// ─── Constants ────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS        = 60_000;       // poll every 60 seconds
const BATCH_SIZE              = 500;          // insert in batches
const STARTUP_DELAY_MS        = 20_000;       // wait for app to fully boot
const MIN_POLL_GAP_MS         = 30_000;       // debounce guard
const CHECKPOINT_KEY          = 'mysql_cdr_last_flowno';

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

// ─── Column mapping: source → your CDR model ─────────────────────────────────

/**
 * Maps a raw row from e_cdr_YYYYMMDD to your CDR model fields.
 * Returns null if the row should be skipped (active/incomplete call).
 */
function mapRowToCDR(row, sourceTag) {
  // Skip calls still in progress (stoptime === starttime)
  // Skip calls with no stop time
  if (!row.stoptime || row.stoptime <= row.starttime) return null;

  return {
    // Identity
    flowno:               row.flowno?.toString()        ?? null,
    softswitchcallid:     row.softswitchcallid?.toString() ?? null,
    callercallid:         row.callercallid               ?? null,
    calleroriginalcallid: row.calleroriginalcallid       ?? null,

    // Caller info
    callere164:           row.callere164                 ?? null,
    calleraccesse164:     row.calleraccesse164           ?? null,
    callerip:             row.callerip                   ?? null,
    callercodec:          row.callercodec                ?? null,
    callergatewayid:      row.callergatewayid            ?? null,
    callerproductid:      row.callerproductid            ?? null,
    callertogatewaye164:  row.callertogatewaye164        ?? null,
    callertype:           row.callertype                 ?? null,
    callerareacode:       row.callerareacode             ?? null,

    // Callee info
    calleee164:           row.calleee164                 ?? null,
    calleeaccesse164:     row.calleeaccesse164           ?? null,
    calleeip:             row.calleeip                   ?? null,
    calleecodec:          row.calleecodec                ?? null,
    calleegatewayid:      row.calleegatewayid            ?? null,
    calleeproductid:      row.calleeproductid            ?? null,
    calleetogatewaye164:  row.calleetogatewaye164        ?? null,
    calleetype:           row.calleetype                 ?? null,
    calleeareacode:       row.calleeareacode             ?? null,

    // Timing (already in ms — matches your existing CDR format)
    starttime:            row.starttime?.toString()      ?? null,
    stoptime:             row.stoptime?.toString()       ?? null,
    feetime:              row.feetime                    ?? 0,
    agentfeetime:         row.agentfeetime               ?? 0,
    suitefeetime:         row.suitefeetime               ?? 0,
    agentsuitefeetime:    row.agentsuitefeetime          ?? 0,
    holdtime:             row.holdtime                   ?? 0,
    callerpdd:            row.callerpdd                  ?? 0,
    calleepdd:            row.calleepdd                  ?? 0,

    // Billing
    fee:                  row.fee                        ?? 0,
    tax:                  row.tax                        ?? 0,
    suitefee:             row.suitefee                   ?? 0,
    incomefee:            row.incomefee                  ?? 0,
    incometax:            row.incometax                  ?? 0,
    agentfee:             row.agentfee                   ?? 0,
    agenttax:             row.agenttax                   ?? 0,
    agentsuitefee:        row.agentsuitefee              ?? 0,
    billingmode:          row.billingmode                ?? 0,
    billingtype:          row.billingtype                ?? 0,
    calllevel:            row.calllevel                  ?? 0,
    cdrlevel:             row.cdrlevel                   ?? 0,

    // Customer
    customeraccount:      row.customeraccount            ?? null,
    customername:         row.customername               ?? null,
    agentaccount:         row.agentaccount               ?? null,
    agentname:            row.agentname                  ?? null,
    agentcdr_id:          row.agentcdr_id                ?? null,

    // Call result
    enddirection:         row.enddirection               ?? null,
    endreason:            row.endreason                  ?? null,
    rtpforward:           row.rtpforward                 ?? 0,
    softswitchname:       row.softswitchname             ?? null,

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
    return BigInt(trimmed);
  }

  // SystemSetting.value is JSON; guard legacy/object forms safely.
  if (typeof value === 'object') {
    if (value.flowno !== undefined && value.flowno !== null) {
      return toBigIntCheckpoint(value.flowno);
    }
    if (value.value !== undefined && value.value !== null) {
      return toBigIntCheckpoint(value.value);
    }
  }

  return 0n;
}

// Store last fetched flowno in your SystemSetting model
async function getCheckpoint(sourceId, tableName) {
  const SystemSetting = require('../models/SystemSetting');
  const key = `${CHECKPOINT_KEY}_${sourceId}_${tableName}`;
  const setting = await SystemSetting.findOne({ where: { key }, raw: true });
  return setting ? toBigIntCheckpoint(setting.value) : 0n;
}

async function saveCheckpoint(sourceId, tableName, flowno) {
  const SystemSetting = require('../models/SystemSetting');
  const key = `${CHECKPOINT_KEY}_${sourceId}_${tableName}`;
  await SystemSetting.upsert({ key, value: flowno.toString() });
}

// ─── Table name helper ────────────────────────────────────────────────────────

function getUtcTableName(dayOffset = 0) {
  const now = new Date();
  const utcDate = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + dayOffset,
    0, 0, 0, 0
  ));

  const y = utcDate.getUTCFullYear();
  const m = String(utcDate.getUTCMonth() + 1).padStart(2, '0');
  const d = String(utcDate.getUTCDate()).padStart(2, '0');
  return `e_cdr_${y}${m}${d}`;
}

function getTodayTableName() {
  return getUtcTableName(0);
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
      host: firstNonEmptyValue(process.env.MYSQL_CDR_HOST, process.env.SERVER_IP),
      port: Number(firstNonEmptyValue(process.env.MYSQL_CDR_PORT, process.env.SERVER_DB_PORT, 3306)),
      user: firstNonEmptyValue(process.env.MYSQL_CDR_USER, process.env.SERVER_DB_USER, process.env.SSH_USERNAME),
      password: firstNonEmptyValue(process.env.MYSQL_CDR_PASSWORD, process.env.SERVER_DB_PASSWORD),
      database: firstNonEmptyValue(process.env.MYSQL_CDR_DATABASE, process.env.SERVER_DB_NAME, 'vos3000'),
      sourceId: firstNonEmptyValue(process.env.MYSQL_CDR_SOURCE_ID, process.env.SERVER_IP, 'mysql-source'),
      useSshTunnel,
      tunnelLocalPort: Number(firstNonEmptyValue(process.env.MYSQL_CDR_TUNNEL_LOCAL_PORT, 13306)),
      tunnelRemotePort: Number(firstNonEmptyValue(process.env.MYSQL_CDR_REMOTE_PORT, process.env.MYSQL_CDR_PORT, 3306)),
      tunnelRemoteHost: firstNonEmptyValue(process.env.MYSQL_CDR_REMOTE_HOST, '127.0.0.1'),
      sshHost: firstNonEmptyValue(process.env.SERVER_IP),
      sshUser: firstNonEmptyValue(process.env.SSH_USERNAME),
      sshPort: Number(firstNonEmptyValue(process.env.SSH_PORT, 22)),
      sshKeyPath: firstNonEmptyValue(process.env.SSH_KEY_PATH),
    };

    this.config    = { ...envConfig, ...config };
    this.sourceId  = this.config.sourceId;
    this.pool      = null;
    this.started   = false;
    this.running   = false;
    this.lastRunAt = 0;
    this._interval = null;
    this._sshTunnelProcess = null;
    this._onProcessExit = () => {
      if (this._sshTunnelProcess) {
        this._sshTunnelProcess.kill('SIGTERM');
        this._sshTunnelProcess = null;
      }
    };

    process.on('exit', this._onProcessExit);
    process.on('SIGINT', this._onProcessExit);
    process.on('SIGTERM', this._onProcessExit);

    // Preserve existing startup behavior from index.js (new CDRAutoFetcher()).
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
      console.warn(
        `[MySQLCDRFetcher:${this.sourceId}] Disabled - missing config: ${missing.join(', ')}`
      );
      return;
    }

    this.started = true;

    console.log(
      `[MySQLCDRFetcher:${this.sourceId}] Connection mode=${this.config.useSshTunnel ? 'ssh-tunnel' : 'direct'} ` +
      `db=${this.config.database} mysql=${this.config.useSshTunnel ? `127.0.0.1:${this.config.tunnelLocalPort}` : `${this.config.host}:${this.config.port}`}`
    );

    if (this.config.useSshTunnel) {
      await this._startSshTunnel();
    }

    // Create connection pool — not a single connection
    // Pool handles reconnects automatically if the source server drops
    this.pool = mysql.createPool({
      host:               this.config.useSshTunnel ? '127.0.0.1' : this.config.host,
      port:               this.config.useSshTunnel ? this.config.tunnelLocalPort : (this.config.port || 3306),
      user:               this.config.user,
      password:           this.config.password,
      database:           this.config.database,
      waitForConnections: true,
      connectionLimit:    3,       // small pool — we only need a few connections
      queueLimit:         10,
      connectTimeout:     10_000,
      // Important for MyISAM: disable transactions (MyISAM doesn't support them)
      multipleStatements: false,
    });

    // Verify connectivity before starting the poll loop
    try {
      const conn = await this.pool.getConnection();
      await conn.ping();
      conn.release();
      console.log(`[MySQLCDRFetcher:${this.sourceId}] Connected to source DB`);
    } catch (err) {
      console.error(`[MySQLCDRFetcher:${this.sourceId}] Cannot connect to source DB:`, err.message);
      // Don't crash the app — retry on next poll
    }

    // Wait for app to fully boot then start polling
    setTimeout(() => {
      this._poll();
      this._interval = setInterval(() => this._poll(), POLL_INTERVAL_MS);
    }, STARTUP_DELAY_MS);

    console.log(`[MySQLCDRFetcher:${this.sourceId}] Fetcher started — polling every ${POLL_INTERVAL_MS / 1000}s`);
  }

  stop() {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
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

    process.off('exit', this._onProcessExit);
    process.off('SIGINT', this._onProcessExit);
    process.off('SIGTERM', this._onProcessExit);

    this.started = false;
    console.log(`[MySQLCDRFetcher:${this.sourceId}] Fetcher stopped`);
  }

  async _canConnectLocalPort(port) {
    return new Promise((resolve) => {
      const socket = net.createConnection({ host: '127.0.0.1', port });

      socket.once('connect', () => {
        socket.destroy();
        resolve(true);
      });

      socket.once('error', () => {
        socket.destroy();
        resolve(false);
      });
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
    const missing = required.filter((key) => !this.config[key]);
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
      `${this.config.sshUser}@${this.config.sshHost}`,
    ];

    this._sshTunnelProcess = spawn('ssh', args, {
      stdio: ['ignore', 'ignore', 'pipe'],
    });

    this._sshTunnelProcess.stderr.on('data', (chunk) => {
      const msg = String(chunk || '').trim();
      if (msg) {
        console.error(`[MySQLCDRFetcher:${this.sourceId}] SSH tunnel: ${msg}`);
      }
    });

    await new Promise((resolve, reject) => {
      let finished = false;

      const onExit = (code) => {
        if (finished) return;
        finished = true;
        reject(new Error(`SSH tunnel exited early with code ${code}`));
      };

      this._sshTunnelProcess.once('exit', onExit);

      const startedAt = Date.now();
      const tryConnect = () => {
        if (finished) return;

        const socket = net.createConnection({ host: '127.0.0.1', port: this.config.tunnelLocalPort });

        socket.once('connect', () => {
          socket.destroy();
          finished = true;
          this._sshTunnelProcess?.off('exit', onExit);
          resolve();
        });

        socket.once('error', () => {
          socket.destroy();
          if (Date.now() - startedAt > 25_000) {
            finished = true;
            this._sshTunnelProcess?.off('exit', onExit);
            reject(new Error(`SSH tunnel did not open local forwarding port within 25s. Tunnel may not have connected. Check SSH_KEY_PATH, SERVER_IP, SSH_USERNAME, SSH_PORT, and firewall.`));
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

    if (this.lastRunAt && (now - this.lastRunAt) < MIN_POLL_GAP_MS) {
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

  // ── Core fetch logic ───────────────────────────────────────────────────────

  async _fetchAndInsert() {
    const startedAt  = Date.now();

    // Fetch only the UTC-today table so the poller never mixes in other days.
    const tables = [getTodayTableName()];

    let totalFetched  = 0;
    let totalInserted = 0;

    for (const tableName of tables) {
      const tableCheckpoint = await getCheckpoint(this.sourceId, tableName);
      const result = await this._fetchFromTable(tableName, tableCheckpoint);
      if (!result) continue; // table doesn't exist yet — skip

      totalFetched  += result.fetched;
      totalInserted += result.inserted;
      if (result.maxFlowno > tableCheckpoint) {
        await saveCheckpoint(this.sourceId, tableName, result.maxFlowno);
      }
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
      console.log(
        `[MySQLCDRFetcher:${this.sourceId}] No new rows in ${tables.join(', ')}`
      );
    }
  }

  async _fetchFromTable(tableName, lastFlowno) {
    // Check if table exists first — new day's table won't exist until midnight
    let tableExists;
    try {
      await this.pool.query(`SELECT 1 FROM \`${tableName}\` LIMIT 1`);
      tableExists = true;
    } catch {
      tableExists = false;
    }

    if (!tableExists) {
      console.log(`[MySQLCDRFetcher:${this.sourceId}] Table ${tableName} not yet available — skipping`);
      return null;
    }

    // Fetch completed calls only (stoptime > starttime) after our last checkpoint
    const [rows] = await this.pool.query(
      `SELECT * FROM \`${tableName}\`
       WHERE flowno > ?
         AND stoptime > starttime
       ORDER BY flowno ASC
       LIMIT ?`,
      [lastFlowno.toString(), BATCH_SIZE]
    );

    if (!rows.length) return { fetched: 0, inserted: 0, maxFlowno: lastFlowno };

    // Map rows to your CDR format, skip invalid ones
    const sourceTag = `${this.sourceId}:${tableName}`;

    const mapped = rows
      .map(row => mapRowToCDR(row, sourceTag))
      .filter(Boolean);

    if (!mapped.length) return { fetched: rows.length, inserted: 0, maxFlowno: lastFlowno };

    // DB schema has a unique index for flowno/source, so dedupe manually as a fast path.
    const flownos = mapped
      .map((cdr) => cdr.flowno)
      .filter(Boolean);

    let existingFlownos = new Set();
    if (flownos.length) {
      const existingRows = await CDR.findAll({
        attributes: ['flowno'],
        where: {
          source_file: sourceTag,
          flowno: flownos,
        },
        raw: true,
      });
      existingFlownos = new Set(existingRows.map((row) => String(row.flowno)));
    }

    const deduped = mapped.filter((cdr) => cdr.flowno && !existingFlownos.has(String(cdr.flowno)));

    if (!deduped.length) {
      const maxFlownoOnly = BigInt(rows[rows.length - 1].flowno);
      return { fetched: rows.length, inserted: 0, maxFlowno: maxFlownoOnly };
    }

    // Bulk insert in batches — avoids single massive INSERT
    let inserted = 0;
    for (let i = 0; i < deduped.length; i += BATCH_SIZE) {
      const batch = deduped.slice(i, i + BATCH_SIZE);
      const result = await CDR.bulkCreate(batch, {
        ignoreDuplicates: true,
        validate:         false, // skip per-row validation for bulk perf
      });
      inserted += result.length;
    }

    const maxFlowno = BigInt(rows[rows.length - 1].flowno);
    return { fetched: rows.length, inserted, maxFlowno };
  }
}

module.exports = MySQLCDRFetcher;