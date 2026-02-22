/**
 * storage/db.js
 * Neon Postgres storage with FULL debug logging
 */

const { Pool } = require('pg');

const CONNECTION_STRING =
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  null;

console.log('[storage/db] module loaded');
console.log('[storage/db] POSTGRES_URL exists:', !!process.env.POSTGRES_URL);
console.log('[storage/db] DATABASE_URL exists:', !!process.env.DATABASE_URL);

function getPool() {
  try {
    if (!CONNECTION_STRING) {
      console.error('[storage/db] ❌ No connection string provided');
      return null;
    }

    if (globalThis.__waline_pg_pool) {
      console.log('[storage/db] reuse existing pool');
      return globalThis.__waline_pg_pool;
    }

    console.log('[storage/db] creating new pg Pool');

    const pool = new Pool({
      connectionString: CONNECTION_STRING,
      max: 2,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on('connect', client => {
      console.log('[storage/db] ✅ client connected');
    });

    pool.on('error', err => {
      console.error('[storage/db] ❌ pool error:', err);
    });

    globalThis.__waline_pg_pool = pool;

    console.log('[storage/db] ✅ pool created');

    return pool;
  } catch (err) {
    console.error('[storage/db] ❌ getPool exception:', err);
    return null;
  }
}

/**
 * Test DB connection
 */
async function testConnection(pool) {
  try {
    console.log('[storage/db] testing connection...');

    const res = await pool.query('SELECT NOW() as now');

    console.log('[storage/db] ✅ connection OK, server time:', res.rows[0].now);

    return true;
  } catch (err) {
    console.error('[storage/db] ❌ connection FAILED:', {
      message: err.message,
      code: err.code,
      stack: err.stack
    });

    return false;
  }
}

/**
 * UPSERT third-party info
 */
async function upsertThirdPartyInfo(platform, user) {
  console.log('[storage/db] ===== UPSERT START =====');

  try {
    console.log('[storage/db] input:', {
      platform,
      id: user?.id,
      name: user?.name,
      email: user?.email
    });

    if (!CONNECTION_STRING) {
      console.error('[storage/db] ❌ skipped: no CONNECTION_STRING');
      return false;
    }

    if (!platform || !user?.id) {
      console.error('[storage/db] ❌ skipped: missing platform or id');
      return false;
    }

    const pool = getPool();

    if (!pool) {
      console.error('[storage/db] ❌ pool unavailable');
      return false;
    }

    // test connection first
    const ok = await testConnection(pool);

    if (!ok) {
      console.error('[storage/db] ❌ connection test failed');
      return false;
    }

    const query = `
      INSERT INTO wl_3rd_info
      (platform, id, name, email, avatar, profile_url, created_at, updated_at)
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
      String(platform),
      String(user.id),
      user.name ?? null,
      user.email ?? null,
      user.avatar ?? null,
      user.url ?? null
    ];

    console.log('[storage/db] executing query...');
    console.log('[storage/db] values:', values);

    const result = await pool.query(query, values);

    console.log('[storage/db] ✅ UPSERT success');
    console.log('[storage/db] rowCount:', result.rowCount);

    console.log('[storage/db] ===== UPSERT END =====');

    return true;
  } catch (err) {
    console.error('[storage/db] ❌ UPSERT FAILED FULL ERROR:');

    console.error({
      message: err.message,
      code: err.code,
      detail: err.detail,
      schema: err.schema,
      table: err.table,
      column: err.column,
      constraint: err.constraint,
      stack: err.stack
    });

    console.log('[storage/db] ===== UPSERT END =====');

    return false;
  }
}

module.exports = {
  upsertThirdPartyInfo,
  getPool
};