// storage/db.js
const { sql } = require('@vercel/postgres');

console.log('[storage/db] using @vercel/postgres');

let tableReady = false;

async function ensureTable() {
  if (tableReady) return;

  console.log('[storage/db] creating table...');

  await sql`
    CREATE TABLE IF NOT EXISTS wl_3rd_info (
      platform TEXT NOT NULL,
      id TEXT NOT NULL,
      name TEXT,
      email TEXT,
      avatar TEXT,
      url TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (platform, id)
    )
  `;

  tableReady = true;

  console.log('[storage/db] table ready');
}

async function upsertThirdPartyInfo(platform, user) {
  try {
    console.log('[storage/db] upsert start:', platform, user.id);

    await ensureTable();

    await sql`
      INSERT INTO wl_3rd_info
      (platform, id, name, email, avatar, url, updated_at)
      VALUES
      (${platform},
       ${user.id},
       ${user.name || null},
       ${user.email || null},
       ${user.avatar || null},
       ${user.url || null},
       CURRENT_TIMESTAMP)
      ON CONFLICT (platform, id)
      DO UPDATE SET
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        avatar = EXCLUDED.avatar,
        url = EXCLUDED.url,
        updated_at = CURRENT_TIMESTAMP
    `;

    console.log('[storage/db] upsert success');

    return true;
  }
  catch (err) {
    console.error('[storage/db] upsert failed:', err.message);
    return false;
  }
}

module.exports = {
  upsertThirdPartyInfo
};