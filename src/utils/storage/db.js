// storage/db.js
// Serverless-friendly PostgreSQL helper for Vercel + Neon.
// - Reuses a single Pool across warm starts (global.__pgPool).
// - Sets small timeouts for connections and queries to avoid hanging serverless requests.
// - Ensures the wl_3rd_info table exists (only once per process).

const { Pool } = require('pg');

console.log('[storage/db] module loaded');

// Accept multiple env var names for convenience (match your Vercel env)
const POSTGRES_URL =
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.DATABASE_URL ||
  process.env.NEON_DATABASE_URL ||
  process.env.PG_CONNECTION_STRING;

console.log('[storage/db] POSTGRES_URL exists:', !!process.env.POSTGRES_URL);
console.log('[storage/db] DATABASE_URL exists:', !!process.env.DATABASE_URL);
console.log('[storage/db] using URL present:', !!POSTGRES_URL);

if (!POSTGRES_URL) {
  console.error('[storage/db] No POSTGRES_URL provided -- DB disabled');
}

// Pool options tuned for serverless usage
const POOL_OPTIONS = POSTGRES_URL
  ? {
      connectionString: POSTGRES_URL,
      // Many managed DBs terminate TLS themselves; still set rejectUnauthorized = false
      // so client will not fail in environments where full CA chain isn't available.
      ssl: { rejectUnauthorized: false },
      // Keep connections extremely small for serverless
      max: 1,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 2000 // fail connection attempts fast
    }
  : null;

// Reuse pool across warm invocations
if (POOL_OPTIONS && !global.__pgPool) {
  global.__pgPool = new Pool(POOL_OPTIONS);

  global.__pgPool.on('connect', () => {
    console.log('[storage/db] pool connected');
  });

  global.__pgPool.on('error', err => {
    console.error('[storage/db] pool error:', err && err.message);
  });
}

const pool = global.__pgPool || null;

// Table ensure guard (only once per process)
let _tableEnsured = false;

/**
 * Run a pool.query with a timeout so queries cannot hang indefinitely.
 * Throws on timeout or query error.
 */
async function queryWithTimeout(text, params = [], timeoutMs = 2500) {
  if (!pool) throw new Error('no-pool');
  const qPromise = pool.query(text, params);
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('query_timeout')), timeoutMs)
  );
  return Promise.race([qPromise, timeout]);
}

/**
 * Ensure table exists (run once per process; failures are logged but do not throw).
 */
async function ensureTable() {
  if (!pool) return;
  if (_tableEnsured) return;
  try {
    const createSql = `
      CREATE TABLE IF NOT EXISTS wl_3rd_info (
        platform TEXT NOT NULL,
        id TEXT NOT NULL,
        name TEXT,
        email TEXT,
        avatar TEXT,
        url TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY(platform, id)
      )
    `;
    await queryWithTimeout(createSql, [], 3000);
    _tableEnsured = true;
    console.log('[storage/db] wl_3rd_info table ensured');
  } catch (err) {
    console.error('[storage/db] ensureTable failed:', err && err.message);
    // do not rethrow — table ensure is best-effort
  }
}

/**
 * Upsert third-party user info.
 * Returns true on success, false on failure or if pool isn't available.
 */
async function upsertThirdPartyInfo(platform, user) {
  try {
    if (!pool) {
      console.warn('[storage/db] pool not available (skipping upsert)');
      return false;
    }

    if (!platform || !user || !user.id) {
      console.warn('[storage/db] upsert called with invalid args', { platform, id: user && user.id });
      return false;
    }

    console.log('[storage/db] upsertThirdPartyInfo called:', platform, user.id);

    // Ensure the table exists (best-effort)
    await ensureTable();

    const sql = `
      INSERT INTO wl_3rd_info
      (platform, id, name, email, avatar, url, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,CURRENT_TIMESTAMP)
      ON CONFLICT (platform, id)
      DO UPDATE SET
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        avatar = EXCLUDED.avatar,
        url = EXCLUDED.url,
        updated_at = CURRENT_TIMESTAMP
    `;

    // Use a relatively short query timeout so a slow DB won't block
    try {
      const result = await queryWithTimeout(
        sql,
        [
          platform,
          user.id,
          user.name || null,
          user.email || null,
          user.avatar || null,
          user.url || null
        ],
        2000 // 2 seconds for upsert
      );
      console.log('[storage/db] upsert success, rowCount:', result && result.rowCount);
      return true;
    } catch (qerr) {
      console.error('[storage/db] upsert query failed:', qerr && qerr.message);
      return false;
    }
  } catch (err) {
    console.error('[storage/db] upsert failed (outer):', err && err.message);
    return false;
  }
}

module.exports = {
  upsertThirdPartyInfo
};

console.log('[storage/db] exports ready');