// src/db.js
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.PG_POOL_MAX || 20),
  idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT || 30000),
  connectionTimeoutMillis: Number(process.env.PG_CONN_TIMEOUT || 10000),
  ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

// Ensure every new client session has public in the search_path so unqualified
// (but quoted) table names like "Users" and "ProgressHistory" resolve correctly.
pool.on('connect', (client) => {
  client
    .query("SET search_path = public, pg_catalog;")
    .catch((err) => {
      // Log but don't crash the app on a single failed SET
      console.error('Failed to set search_path for new DB client', err && err.message ? err.message : err);
    });
});

pool.on('error', (err) => {
  console.error('Unexpected PG pool error:', err); // keep running; do not crash
});

async function query(text, params) {
  return pool.query(text, params);
}

async function connect() {
  return pool.connect();
}

// helper: run a single transactional function
async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {}
    throw e;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, connect, tx };
