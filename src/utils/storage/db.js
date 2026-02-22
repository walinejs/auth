const { sql, createPool } = require('@vercel/postgres');

/**
 * STRATEGY: 
 * 1. Clean the POSTGRES_URL to remove ?sslmode=require which causes the 
 * "Pre data did not match expectation" error.
 * 2. Remove the ensureTable logic to prevent the "stuck" behavior.
 */

const rawUrl = process.env.POSTGRES_URL || '';
// Remove any sslmode parameter that causes the handshake conflict
const cleanUrl = rawUrl.replace(/([\?&])sslmode=[^&]+(&|$)/, '$1').replace(/\?$/, '');

// Create a pool with the cleaned URL
const pool = createPool({
  connectionString: cleanUrl,
});

async function upsertThirdPartyInfo(platform, user) {
  try {
    console.log('[storage/db] upsert start:', platform, user.id);

    // Using pool.sql to ensure we use our cleaned connection string
    await pool.sql`
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
  } catch (err) {
    console.error('[storage/db] upsert failed:', err.message);
    return false;
  }
}

module.exports = {
  upsertThirdPartyInfo
};