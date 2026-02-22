// storage/db.js
const { createPool } = require('@vercel/postgres');

// 1. Manually strip the sslmode to avoid the handshake conflict
const rawUrl = process.env.POSTGRES_URL || '';
const cleanUrl = rawUrl.replace(/([\?&])sslmode=[^&]+(&|$)/, '$1').replace(/\?$/, '');

// 2. Create a persistent pool outside the handler for connection reuse
const pool = createPool({
  connectionString: cleanUrl,
});

async function upsertThirdPartyInfo(platform, user) {
  try {
    console.log('[storage/db] upsert start:', platform, user.id);

    // Use pool.query for the most stable background execution
    await pool.query(
      `INSERT INTO wl_3rd_info 
       (platform, id, name, email, avatar, url, updated_at) 
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
       ON CONFLICT (platform, id) 
       DO UPDATE SET 
         name = EXCLUDED.name, 
         email = EXCLUDED.email, 
         avatar = EXCLUDED.avatar, 
         url = EXCLUDED.url, 
         updated_at = CURRENT_TIMESTAMP`,
      [platform, user.id, user.name || null, user.email || null, user.avatar || null, user.url || null]
    );

    console.log('[storage/db] upsert success');
    return true;
  } catch (err) {
    console.error('[storage/db] DB Query Error:', err.message);
    return false;
  }
}

module.exports = { upsertThirdPartyInfo };