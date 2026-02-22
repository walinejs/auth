// storage/db.js

console.log('[storage/db] module loaded');

let sql = null;

try {
  const { neon } = require('@neondatabase/serverless');

  const DATABASE_URL =
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.DATABASE_URL;

  if (!DATABASE_URL) {
    console.error('[storage/db] DATABASE_URL missing');
  } else {
    console.log('[storage/db] creating neon sql client');

    // IMPORTANT: use Neon HTTP driver
    sql = neon(DATABASE_URL);
  }

} catch (err) {
  console.error('[storage/db] neon import failed:', err.message);
}

let tableReady = false;

async function ensureTable() {

  if (!sql) return;

  if (tableReady) return;

  try {

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
        PRIMARY KEY(platform, id)
      )
    `;

    tableReady = true;

    console.log('[storage/db] table ready');

  } catch (err) {

    console.error('[storage/db] ensureTable failed:', err.message);

  }
}

async function upsertThirdPartyInfo(platform, user) {

  try {

    if (!sql) {
      console.warn('[storage/db] sql not available');
      return false;
    }

    console.log('[storage/db] upsert start:', platform, user.id);

    await ensureTable();

    await sql`
      INSERT INTO wl_3rd_info
      (platform, id, name, email, avatar, url, updated_at)
      VALUES
      (${platform}, ${user.id}, ${user.name}, ${user.email}, ${user.avatar}, ${user.url}, CURRENT_TIMESTAMP)
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

  } catch (err) {

    console.error('[storage/db] upsert failed:', err.message);

    return false;
  }

}

module.exports = {
  upsertThirdPartyInfo
};