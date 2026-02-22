import pkg from 'pg';

const { Pool } = pkg;

console.log('[storage/db] module loaded');

const POSTGRES_URL =
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL;

console.log('[storage/db] POSTGRES_URL exists:', !!process.env.POSTGRES_URL);
console.log('[storage/db] DATABASE_URL exists:', !!process.env.DATABASE_URL);

if (!POSTGRES_URL) {
  console.error('[storage/db] NO DATABASE URL');
}

const pool = POSTGRES_URL
  ? new Pool({
      connectionString: POSTGRES_URL,
      ssl: { rejectUnauthorized: false }
    })
  : null;

export async function saveUserToDB(user) {

  console.log('[storage/db] saveUserToDB called');

  if (!pool) {
    throw new Error('Pool not initialized');
  }

  const client = await pool.connect();

  try {

    const res = await client.query(
      `
      INSERT INTO wl_users (display_name, email, avatar, huawei)
      VALUES ($1,$2,$3,$4)
      ON CONFLICT (huawei)
      DO UPDATE SET
        display_name = EXCLUDED.display_name,
        email = EXCLUDED.email,
        avatar = EXCLUDED.avatar
      RETURNING *
      `,
      [
        user.display_name ?? null,
        user.email ?? null,
        user.avatar ?? null,
        user.provider_id ?? null
      ]
    );

    console.log('[storage/db] DB write success');

    return res.rows[0];

  } finally {
    client.release();
  }
}