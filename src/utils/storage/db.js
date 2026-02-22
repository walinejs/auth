const { Client } = require('pg');

const POSTGRES_URL =
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  process.env.NEON_DATABASE_URL;

function normalizeSsl(url) {
  if (!url) return url;
  if (/sslmode=/i.test(url)) {
    return url.replace(/sslmode=[^&]*/i, 'sslmode=verify-full');
  }
  return url + (url.includes('?') ? '&' : '?') + 'sslmode=verify-full';
}

const SAFE_URL = normalizeSsl(POSTGRES_URL);

function timeout(ms) {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error("timeout")), ms)
  );
}

async function upsertThirdPartyInfo(platform, user) {

  if (!SAFE_URL) return false;
  if (!platform || !user?.id) return false;

  let client;

  try {

    client = new Client({
      connectionString: SAFE_URL,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 1500
    });

    await Promise.race([
      client.connect(),
      timeout(1500)
    ]);

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
      timeout(1500)
    ]);

    await Promise.race([
      client.query(`
        INSERT INTO wl_3rd_info
        (platform,id,name,email,avatar,url,updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,CURRENT_TIMESTAMP)
        ON CONFLICT (platform,id)
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
      timeout(1500)
    ]);

    await client.end();

    console.log('[storage/db] upsert success');

    return true;

  } catch (err) {

    console.error('[storage/db] upsert failed:', err.message);

    if (client) {
      try { await client.end(); } catch {}
    }

    return false;
  }
}

module.exports = { upsertThirdPartyInfo };