// storage/db.js
const { Pool } = require('pg');

console.log('[storage/db] module loaded');

const POSTGRES_URL =
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.DATABASE_URL;

console.log('[storage/db] POSTGRES_URL exists:', !!process.env.POSTGRES_URL);
console.log('[storage/db] DATABASE_URL exists:', !!process.env.DATABASE_URL);
console.log('[storage/db] using URL:', POSTGRES_URL ? 'YES' : 'NO');

let pool = null;

if (POSTGRES_URL) {
  pool = new Pool({
    connectionString: POSTGRES_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  pool.on('connect', () => {
    console.log('[storage/db] pool connected');
  });

  pool.on('error', err => {
    console.error('[storage/db] pool error:', err.message);
  });
} else {
  console.error('[storage/db] No POSTGRES_URL provided');
}

/**
 * Create table if not exists
 */
async function ensureTable() {
  if (!pool) return;

  await pool.query(`
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
  `);
}

/**
 * Upsert user info
 */
async function upsertThirdPartyInfo(platform, user) {
  try {
    if (!pool) {
      console.warn('[storage/db] pool not available');
      return false;
    }

    console.log('[storage/db] upsertThirdPartyInfo called:', platform, user.id);

    await ensureTable();

    const result = await pool.query(
      `
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
      `,
      [
        platform,
        user.id,
        user.name || null,
        user.email || null,
        user.avatar || null,
        user.url || null
      ]
    );

    console.log('[storage/db] upsert success:', result.rowCount);

    return true;
  } catch (err) {
    console.error('[storage/db] upsert failed:', err.message);
    console.error(err.stack);
    return false;
  }
}

module.exports = {
  upsertThirdPartyInfo
};

console.log('[storage/db] exports:', module.exports);