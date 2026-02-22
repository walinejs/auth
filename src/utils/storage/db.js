// storage/db.js
// Small storage module for upserting third-party user info into wl_3rd_info.
// Returns boolean success and never throws to caller (errors are logged).

const { Pool } = require('pg');

const CONNECTION_STRING = process.env.POSTGRES_URL || process.env.DATABASE_URL || null;
if (!CONNECTION_STRING) {
  console.warn('[storage/db] No POSTGRES_URL/DATABASE_URL found in env; DB operations will be disabled.');
}

/**
 * Create or reuse a singleton pg Pool (prevents connection storms on Vercel).
 * For Vercel Fluid you may also want to call attachDatabasePool(pool) from @vercel/functions.
 */
function getPool() {
  if (!CONNECTION_STRING) return null;

  if (globalThis.__waline_pg_pool) {
    return globalThis.__waline_pg_pool;
  }

  const pool = new Pool({
    connectionString: CONNECTION_STRING,
    // sensible defaults; adjust if you have a recommended pooler or PgBouncer
    max: Number(process.env.PG_POOL_MAX || 2), // keep small for serverless
    idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT || 30000),
    connectionTimeoutMillis: Number(process.env.PG_CONN_TIMEOUT || 2000),
    //ssl: process.env.PG_SSL === 'false' ? false : { rejectUnauthorized: false }
    ssl: false
  });

  // Optional: if using Vercel Fluid, you can attach the pool for better lifecycle handling:
  // try { const { attachDatabasePool } = require('@vercel/functions'); attachDatabasePool(pool); } catch(e) {}

  globalThis.__waline_pg_pool = pool;
  return pool;
}

/**
 * Upsert a third-party user record into wl_3rd_info.
 * - platform: string (e.g. 'huawei')
 * - user: object { id, name, email, avatar, url }
 *
 * Returns true on success, false on failure or if DB disabled.
 */
async function upsertThirdPartyInfo(platform, user) {
  if (!CONNECTION_STRING) {
    console.warn('[storage/db] DB disabled: skipping upsert for', platform, user && user.id);
    return false;
  }

  if (!platform || !user || !user.id) {
    console.warn('[storage/db] missing platform or user.id, skipping upsert');
    return false;
  }

  const pool = getPool();
  if (!pool) return false;

  const query = `
    INSERT INTO wl_3rd_info (platform, id, name, email, avatar, profile_url, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT (platform, id)
    DO UPDATE SET
      name = EXCLUDED.name,
      email = EXCLUDED.email,
      avatar = EXCLUDED.avatar,
      profile_url = EXCLUDED.profile_url,
      updated_at = CURRENT_TIMESTAMP;
  `;

  const values = [
    platform,
    String(user.id),
    user.name ?? null,
    user.email ?? null,
    user.avatar ?? null,
    user.url ?? null
  ];

  try {
    await pool.query(query, values);
    console.log('[storage/db] upsert succeeded for', platform, user.id);
    return true;
  } catch (err) {
    // Log everything but do not throw so caller keeps working.
    console.error('[storage/db] upsert error for', platform, user.id, err && err.message);
    // Optionally, for debugging you can log err.stack in dev env.
    return false;
  }
}

module.exports = {
  upsertThirdPartyInfo,
  // export pool getter if you want to run ad-hoc queries elsewhere
  getPool
};