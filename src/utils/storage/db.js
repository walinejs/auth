// storage/db.js
// Defensive Neon helper for Vercel + Neon (serverless).
// - Uses @neondatabase/serverless when available (HTTP queries, serverless-friendly).
// - If not available or DATABASE_URL missing, becomes a safe no-op that logs.
// - All DB calls are awaited with a short timeout; returns true/false.

const TIMEOUT_MS = 1500; // how long we wait for DB operations before giving up (tunable)

console.log('[storage/db] module loaded');

let sql = null;
let neonPresent = false;

const RAW_DB_URL =
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.DATABASE_URL ||
  process.env.NEON_DATABASE_URL ||
  process.env.PG_CONNECTION_STRING ||
  null;

console.log('[storage/db] RAW_DB_URL present:', !!RAW_DB_URL);

// try to require neon driver
try {
  // require inside try so missing package doesn't crash the whole function
  // eslint-disable-next-line global-require
  const neonModule = require('@neondatabase/serverless');
  if (neonModule && typeof neonModule.neon === 'function') {
    neonPresent = true;
    console.log('[storage/db] @neondatabase/serverless available');
  } else {
    console.warn('[storage/db] @neondatabase/serverless found but unexpected export shape');
  }
} catch (e) {
  console.warn('[storage/db] @neondatabase/serverless NOT installed:', e && e.message);
}

// normalize DB URL so we don't get pg ssl warnings
function normalizeDbUrl(url) {
  if (!url) return url;
  try {
    const u = new URL(url);
    if (u.searchParams.get('sslmode')) {
      u.searchParams.set('sslmode', 'verify-full');
    } else {
      u.searchParams.append('sslmode', 'verify-full');
    }
    return u.toString();
  } catch (err) {
    // fallback to string replace
    if (/sslmode=/i.test(url)) {
      return url.replace(/sslmode=[^&]*/i, 'sslmode=verify-full');
    }
    return url + (url.includes('?') ? '&' : '?') + 'sslmode=verify-full';
  }
}

const DATABASE_URL = normalizeDbUrl(RAW_DB_URL);
console.log('[storage/db] DATABASE_URL present after normalize:', !!DATABASE_URL);

// if neon present and URL present, build sql helper
if (neonPresent && DATABASE_URL) {
  // require again safely (we already checked)
  // eslint-disable-next-line global-require
  const { neon } = require('@neondatabase/serverless');
  try {
    sql = neon(DATABASE_URL);
    console.log('[storage/db] neon() sql helper created');
  } catch (e) {
    console.error('[storage/db] neon() creation failed:', e && e.message);
    sql = null;
  }
} else {
  if (!neonPresent) {
    console.warn('[storage/db] neon driver not available — DB operations will be skipped');
  }
  if (!DATABASE_URL) {
    console.warn('[storage/db] DATABASE_URL not set — DB operations will be skipped');
  }
}

/**
 * Promise.race with timeout helper
 */
function withTimeout(p, ms) {
  return Promise.race([
    p,
    new Promise((_, reject) => setTimeout(() => reject(new Error('db_timeout')), ms))
  ]);
}

/**
 * upsertThirdPartyInfo(platform, user)
 * - platform: string (e.g. 'twitter')
 * - user: { id, name, email, avatar, url }
 *
 * Returns: Promise<boolean> true on success, false on failure/no-op
 */
async function upsertThirdPartyInfo(platform, user) {
  console.log('[storage/db] upsertThirdPartyInfo called:', { platform, id: user && user.id });

  if (!platform || !user || !user.id) {
    console.warn('[storage/db] invalid args; skipping upsert', { platform, user });
    return false;
  }

  if (!sql) {
    console.warn('[storage/db] SQL client not configured; skipping upsert');
    return false;
  }

  try {
    // CREATE TABLE IF NOT EXISTS (idempotent)
    console.log('[storage/db] creating table if not exists (start)');
    await withTimeout(
      sql`
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
      TIMEOUT_MS
    );
    console.log('[storage/db] ensure table ok');

    // Upsert
    console.log('[storage/db] running upsert', { platform, id: user.id });
    await withTimeout(
      sql`
        INSERT INTO wl_3rd_info (platform, id, name, email, avatar, url, updated_at)
        VALUES (${platform}, ${user.id}, ${user.name || null}, ${user.email || null}, ${user.avatar || null}, ${user.url || null}, CURRENT_TIMESTAMP)
        ON CONFLICT (platform, id)
        DO UPDATE SET
          name = EXCLUDED.name,
          email = EXCLUDED.email,
          avatar = EXCLUDED.avatar,
          url = EXCLUDED.url,
          updated_at = CURRENT_TIMESTAMP
      `,
      TIMEOUT_MS
    );

    console.log('[storage/db] upsert completed for', platform, user.id);
    return true;
  } catch (err) {
    console.error('[storage/db] upsert failed:', err && err.message);
    // log error object for debugging
    if (err && err.stack) console.error(err.stack);
    return false;
  }
}

module.exports = { upsertThirdPartyInfo };