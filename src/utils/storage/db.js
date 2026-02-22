// storage/db.js
// Neon + Vercel safe version using Client (NOT Pool)

const { Client } = require('pg');

console.log('[storage/db] module loaded');

const POSTGRES_URL =
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.DATABASE_URL ||
  process.env.NEON_DATABASE_URL;

if (!POSTGRES_URL) {
  console.error('[storage/db] No DATABASE_URL provided');
}

/**
 * normalize sslmode to silence warnings
 */
function normalizeSsl(url) {
  if (!url) return url;

  if (/sslmode=/i.test(url)) {
    return url.replace(/sslmode=[^&]*/i, 'sslmode=verify-full');
  }

  return url + (url.includes('?') ? '&' : '?') + 'sslmode=verify-full';
}

const SAFE_URL = normalizeSsl(POSTGRES_URL);

/**
 * Hard timeout wrapper
 */
function timeout(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Main upsert function
 */
async function upsertThirdPartyInfo(platform, user) {

  if (!SAFE_URL) return false;
  if (!platform || !user?.id) return false;

  console.log('[storage/db] upsertThirdPartyInfo called:', platform, user.id);

  // Fully detached async execution
  (async () => {

    let client;

    try {

      client = new Client({
        connectionString: SAFE_URL,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 2000
      });

      await Promise.race([
        client.connect(),
        timeout(2000)
      ]);

      // ensure table
      await Promise.race([
        client.query(`
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
        `),
        timeout(2000)
      ]);

      // upsert
      await Promise.race([
        client.query(`
          INSERT INTO wl_3rd_info
          (platform, id, name, email, avatar, url, updated_at)
          VALUES ($1,$2,$3,$4,$5,$6,CURRENT_TIMESTAMP)
          ON CONFLICT (platform, id)
          DO UPDATE SET
            name=EXCLUDED.name,
            email=EXCLUDED.email,
            avatar=EXCLUDED.avatar,
            url=EXCLUDED.url,
            updated_at=CURRENT_TIMESTAMP
        `, [
          platform,
          user.id,
          user.name || null,
          user.email || null,
          user.avatar || null,
          user.url || null
        ]),
        timeout(2000)
      ]);

      console.log('[storage/db] upsert success:', platform, user.id);

    }
    catch (err) {

      console.error('[storage/db] upsert failed:', err.message);

    }
    finally {

      if (client) {
        try {
          await client.end();
        } catch {}
      }

    }

  })();

  // return immediately so HTTP response is never blocked
  return true;
}

module.exports = {
  upsertThirdPartyInfo
};

console.log('[storage/db] exports ready');