const pool = require("../db/pool");

async function withLock(key, fn) {
  const client = await pool.connect();
  try {
    const { rows } = await client.query("SELECT pg_try_advisory_lock($1) AS ok", [key]);
    if (!rows[0].ok) {
      console.log(`[lock] ${key} held by another instance, skipping`);
      return;
    }
    try { return await fn(); }
    finally { await client.query("SELECT pg_advisory_unlock($1)", [key]); }
  } finally { client.release(); }
}

module.exports = { withLock };
