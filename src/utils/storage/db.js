// storage/db.js
// Diagnostic + robust Neon helper for Vercel.
// - Uses @neondatabase/serverless when available
// - Emits heartbeat logs while queries are pending to diagnose hangs
// - Times out operations reliably and logs the reason

const TIMEOUT_MS = parseInt(process.env.DB_TIMEOUT_MS || '2000', 10); // default 2s
const HEARTBEAT_INTERVAL_MS = 500; // how often to log "still waiting"
const RAW_DB_URL =
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  process.env.NEON_DATABASE_URL ||
  process.env.PG_CONNECTION_STRING ||
  null;

console.log('[storage/db] module loaded');
console.log('[storage/db] RAW_DB_URL present:', !!RAW_DB_URL);
console.log('[storage/db] TIMEOUT_MS:', TIMEOUT_MS);

let neonPresent = false;
let sql = null;

try {
  // require lazily so missing package doesn't crash app
  // eslint-disable-next-line global-require
  const neonModule = require('@neondatabase/serverless');
  if (neonModule && typeof neonModule.neon === 'function') {
    neonPresent = true;
    console.log('[storage/db] @neondatabase/serverless available');
  } else {
    console.warn('[storage/db] @neondatabase/serverless found but shape unexpected');
  }
} catch (e) {
  console.warn('[storage/db] @neondatabase/serverless NOT installed:', e && e.message);
}

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
    if (/sslmode=/i.test(url)) {
      return url.replace(/sslmode=[^&]*/i, 'sslmode=verify-full');
    }
    return url + (url.includes('?') ? '&' : '?') + 'sslmode=verify-full';
  }
}

const DATABASE_URL = normalizeDbUrl(RAW_DB_URL);
console.log('[storage/db] DATABASE_URL normalized present:', !!DATABASE_URL);

if (neonPresent && DATABASE_URL) {
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
  if (!neonPresent) console.warn('[storage/db] neon driver not available — DB ops will be skipped');
  if (!DATABASE_URL) console.warn('[storage/db] DATABASE_URL not set — DB ops will be skipped');
}

/**
 * Run promise with timeout + heartbeat logging.
 * label is used in logs to identify the operation.
 */
async function runWithTimeoutAndHeartbeat(promiseFactory, label, timeoutMs = TIMEOUT_MS) {
  let heartbeatTimer = null;
  let timedOut = false;
  const start = Date.now();

  // create a promise that runs the factory and resolves/rejects accordingly
  const opPromise = (async () => {
    try {
      return await promiseFactory();
    } finally {
      // ensure heartbeat cleared by the normal path as well
      if (heartbeatTimer) clearInterval(heartbeatTimer);
    }
  })();

  // create timeout promise
  const timeoutPromise = new Promise((_, reject) => {
    const id = setTimeout(() => {
      timedOut = true;
      reject(new Error('db_timeout'));
    }, timeoutMs);

    // when main op settles, clear the timeout
    opPromise.then(() => clearTimeout(id), () => clearTimeout(id));
  });

  // heartbeat logger while op is pending
  heartbeatTimer = setInterval(() => {
    console.warn(`[storage/db] heartbeat: still waiting for ${label} after ${Date.now() - start}ms (will timeout at ${timeoutMs}ms)`);
  }, HEARTBEAT_INTERVAL_MS);

  try {
    const res = await Promise.race([opPromise, timeoutPromise]);
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    console.log(`[storage/db] ${label} finished in ${Date.now() - start}ms`);
    return res;
  } catch (err) {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    console.error(`[storage/db] ${label} error after ${Date.now() - start}ms:`, err && err.message);
    // attach info for caller
    err._label = label;
    err._elapsed = Date.now() - start;
    throw err;
  }
}

/**
 * upsertThirdPartyInfo(platform, user)
 * Returns true on success, false on failure/no-op.
 */
async function upsertThirdPartyInfo(platform, user) {
  console.log('[storage/db] upsertThirdPartyInfo called:', { platform, id: user && user.id });

  if (!platform || !user || !user.id) {
    console.warn('[storage/db] invalid args; skipping upsert');
    return false;
  }

  if (!sql) {
    console.warn('[storage/db] sql helper missing; skipping upsert');
    return false;
  }

  try {
    // ensure table
    await runWithTimeoutAndHeartbeat(
      () => sql`
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
      'ensure_table',
      TIMEOUT_MS
    );

    // upsert
    await runWithTimeoutAndHeartbeat(
      () => sql`
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
      'upsert',
      TIMEOUT_MS
    );

    console.log('[storage/db] upsert completed for', platform, user.id);
    return true;
  } catch (err) {
    console.error('[storage/db] upsertThirdPartyInfo failed:', err && err.message, 'label:', err && err._label, 'elapsed:', err && err._elapsed);
    if (err && err.stack) console.error(err.stack);
    return false;
  }
}

module.exports = { upsertThirdPartyInfo };