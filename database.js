const { Pool } = require('pg');

console.log('DATABASE_URL:', process.env.DATABASE_URL ? process.env.DATABASE_URL.replace(/\/\/.*@/, '//***:***@') : 'NOT SET');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost/polling_dev',
});

// Create tables (uses PostgreSQL syntax)
async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS polls (
      id SERIAL PRIMARY KEY,
      question TEXT NOT NULL,
      creator_id INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS options (
      id SERIAL PRIMARY KEY,
      poll_id INTEGER NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
      text TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS votes (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      option_id INTEGER NOT NULL REFERENCES options(id) ON DELETE CASCADE,
      poll_id INTEGER NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
      UNIQUE(user_id, poll_id)
    );
  `);
  console.log('Database tables ready');
}

module.exports = { pool, initializeDatabase };
