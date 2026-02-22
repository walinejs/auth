// storage/db.js
// Simple serverless-friendly Neon helper using @neondatabase/serverless (neon())
//
// Usage: const db = require('./storage/db');
// await db.upsertThirdPartyInfo(platform, user);

const { neon } = require('@neondatabase/serverless');

const RAW_DB_URL =
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.DATABASE_URL ||
  process.env.NEON_DATABASE_URL ||
  process.env.PG_CONNECTION_STRING;

console.log('[storage/db] module loaded. DATABASE_URL present:', !!RAW_DB_URL);

/**
 * Normalize sslmode to avoid pg warning and keep behavior predictable.
 * If the URL already contains sslmode=..., replace it with verify-full.
 */
function normalizeDatabaseUrl(url) {
  if (!url) return url;
  try {
    const u = new URL(url);
    if (u.searchParams.get('sslmode')) {
      u.searchParams.set('sslmode', 'verify-full');
    } else {
      u.searchParams.append('sslmode', 'verify-full');
    }
    return u.toString();
  } catch (e) {
    // fallback simple replace if URL parsing fails for some non-standard provider string
    if (/sslmode=/i.test(url)) {
      return url.replace(/sslmode=[^&]*/i, 'sslmode=verify-full');
    }
    return url + (url.includes('?') ? '&' : '?') + 'sslmode=verify-full';
  }
}

const DATABASE_URL = normalizeDatabaseUrl(RAW_DB_URL);
if (!DATABASE_URL) {
  console.error('[storage/db] No DATABASE_URL found — DB functions will be no-ops.');
}

// Create a `sql` helper using neon().
// neon() is safe to create at module level for serverless (it uses HTTPS for queries).
// It's ideal for single-shot queries (no session) and supports transaction([...]) if needed.
// See Neon serverless docs for details. :contentReference[oaicite:3]{index=3}
const sql = DATABASE_URL ? neon(DATABASE_URL) : null;

/**
 * Simple Promise.race timeout helper.
 * Resolves with the original function result, or rejects if timeout.
 */
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('db_timeout')), ms))
  ]);
}

/**
 * Upsert third-party info.
 * platform: string (e.g. 'twitter')
 * user: { id, name, email, avatar, url }
 *
 * Returns true on success, false on failure (caller can ignore failures).
 */
async function upsertThirdPartyInfo(platform, user) {
  if (!sql) {
    console.warn('[storage/db] upsert skipped: no sql client configured');
    return false;
  }
  if (!platform || !user || !user.id) {
    console.warn('[storage/db] upsert skipped: invalid args', { platform, id: user && user.id });
    return false;
  }

  console.log('[storage/db] upsertThirdPartyInfo called:', platform, user.id);

  // short timeout so we don't hang Vercel functions
  const TIMEOUT_MS = 1500;

  try {
    // create table if not exists (single-shot query)
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

    // upsert using a parameterized tagged template (safe against SQL injection)
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

    console.log('[storage/db] upsertThirdPartyInfo succeeded:', platform, user.id);
    return true;
  } catch (err) {
    // log the error and return false so the login flow can continue
    console.error('[storage/db] upsertThirdPartyInfo failed:', err && err.message);
    return false;
  }
}

module.exports = { upsertThirdPartyInfo };