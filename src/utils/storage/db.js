// storage/db.js
// Serverless-safe PostgreSQL helper for Vercel + Neon.
// Features:
// - Reuses a single Pool across warm invocations (global.__pgPool)
// - Normalizes sslmode to avoid pg SECURITY WARNING
// - Adds query timeouts so DB issues never hang requests
// - Ensures wl_3rd_info table exists (once per process)
// - Safe upsert with full logging

const { Pool } = require('pg');

console.log('[storage/db] module loaded');

// Accept common env var names used by Vercel, Neon, Prisma, etc.
const POSTGRES_URL =
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.DATABASE_URL ||
  process.env.NEON_DATABASE_URL ||
  process.env.PG_CONNECTION_STRING;

console.log('[storage/db] POSTGRES_URL exists:', !!process.env.POSTGRES_URL);
console.log('[storage/db] DATABASE_URL exists:', !!process.env.DATABASE_URL);
console.log('[storage/db] raw URL present:', !!POSTGRES_URL);

if (!POSTGRES_URL) {
  console.error('[storage/db] No database URL provided. DB functions disabled.');
}

/**
 * Normalize SSL query params to silence pg warning and ensure predictable behavior.
 *
 * Default strategy: verify-full (recommended).
 * Alternative: uselibpqcompat (set env PG_SSL_STRATEGY=uselibpqcompat)
 */
function normalizeSslParams(url, strategy = 'verify-full') {
  if (!url) return url;

  const hasSslmode = /([?&])sslmode=[^&]*/i.test(url);

  if (strategy === 'verify-full') {
    if (hasSslmode) {
      return url.replace(/([?&])sslmode=[^&]*/i, '$1sslmode=verify-full');
    }
    return url + (url.includes('?') ? '&' : '?') + 'sslmode=verify-full';
  }

  if (strategy === 'uselibpqcompat') {
    let out = url;
    if (!/([?&])uselibpqcompat=[^&]*/i.test(out)) {
      out += (out.includes('?') ? '&' : '?') + 'uselibpqcompat=true';
    }
    if (hasSslmode) {
      out = out.replace(/([?&])sslmode=[^&]*/i, '$1sslmode=require');
    } else {
      out += '&sslmode=require';
    }
    return out;
  }

  return url;
}

// Choose SSL strategy (default verify-full)
const SSL_STRATEGY = process.env.PG_SSL_STRATEGY || 'verify-full';
const SAFE_POSTGRES_URL = normalizeSslParams(POSTGRES_URL, SSL_STRATEGY);

console.log('[storage/db] ssl strategy:', SSL_STRATEGY);
console.log('[storage/db] sslmode present in safe URL:', !!SAFE_POSTGRES_URL && /sslmode=/i.test(SAFE_POSTGRES_URL));

/**
 * Pool options tuned for serverless
 */
const POOL_OPTIONS = SAFE_POSTGRES_URL
  ? {
      connectionString: SAFE_POSTGRES_URL,
      ssl: { rejectUnauthorized: false },
      max: 1, // keep extremely low for Neon/serverless
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 2000
    }
  : null;

/**
 * Reuse pool across warm invocations
 */
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

/**
 * Ensure table exists only once per process
 */
let tableEnsured = false;

/**
 * Query with timeout protection
 */
async function queryWithTimeout(sql, params = [], timeoutMs = 2500) {
  if (!pool) throw new Error('no_pool');

  const queryPromise = pool.query(sql, params);

  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('query_timeout')), timeoutMs)
  );

  return Promise.race([queryPromise, timeoutPromise]);
}

/**
 * Ensure wl_3rd_info table exists
 */
async function ensureTable() {
  if (!pool || tableEnsured) return;

  try {
    await queryWithTimeout(`
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
    `, [], 3000);

    tableEnsured = true;
    console.log('[storage/db] table ensured');
  } catch (err) {
    console.error('[storage/db] ensureTable failed:', err.message);
  }
}

/**
 * Upsert third-party info safely
 */
async function upsertThirdPartyInfo(platform, user) {
  try {
    if (!pool) {
      console.warn('[storage/db] no pool available, skipping upsert');
      return false;
    }

    if (!platform || !user || !user.id) {
      console.warn('[storage/db] invalid upsert args');
      return false;
    }

    console.log('[storage/db] upsertThirdPartyInfo called:', platform, user.id);

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

    const result = await queryWithTimeout(sql, [
      platform,
      user.id,
      user.name || null,
      user.email || null,
      user.avatar || null,
      user.url || null
    ], 2000);

    console.log('[storage/db] upsert success, rowCount:', result.rowCount);

    return true;
  } catch (err) {
    console.error('[storage/db] upsert failed:', err.message);
    return false;
  }
}

module.exports = {
  upsertThirdPartyInfo
};

console.log('[storage/db] exports ready');