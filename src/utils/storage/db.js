// storage/db.js
const { Pool } = require('pg');

console.log('[storage/db] module loaded');

const POSTGRES_URL =
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.DATABASE_URL ||
  process.env.NEON_DATABASE_URL; // include common variants

console.log('[storage/db] POSTGRES_URL exists:', !!process.env.POSTGRES_URL);
console.log('[storage/db] DATABASE_URL exists:', !!process.env.DATABASE_URL);
console.log('[storage/db] using URL present:', !!POSTGRES_URL);

if (!POSTGRES_URL) {
  console.error('[storage/db] No POSTGRES_URL provided -- DB disabled');
}

// pool options tuned for serverless
const POOL_OPTIONS = POSTGRES_URL
  ? {
      connectionString: POSTGRES_URL,
      ssl: {
        rejectUnauthorized: false
      },
      // tune these for serverless: keep connections small and fail fast
      max: 1,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 2000
    }
  : null;

// reuse pool across lambda invocations (warm starts)
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

let _tableEnsured = false;

async function queryWithTimeout(text, params = [], timeoutMs = 2500) {
  if (!pool) throw new Error('no-pool');
  const qPromise = pool.query(text, params);
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('query_timeout')), timeoutMs)
  );
  return Promise.race([qPromise, timeout]);
}

async function ensureTable() {
  if (!pool) return;
  if (_tableEnsured) return;
  try {
    await queryWithTimeout(
      `
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
      `,
      [],
      3000
    );
    _tableEnsured = true;
    console.log('[storage/db] wl_3rd_info table ensured');
  } catch (err) {
    console.error('[storage/db] ensureTable failed:', err && err.message);
  }
}

async function upsertThirdPartyInfo(platform, user) {
  try {
    if (!pool) {
      console.warn('[storage/db] pool not available (skipping upsert)');
      return false;
    }

    console.log('[storage/db] upsertThirdPartyInfo called:', platform, user && user.id);

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

    try {
      const result = await queryWithTimeout(sql, [
        platform,
        user.id,
        user.name || null,
        user.email || null,
        user.avatar || null,
        user.url || null
      ], 2000);

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