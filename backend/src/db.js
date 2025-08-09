const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Required for railway
  },
});

module.exports = {
  query: (text, params) => {
    return pool.query(text, params);
  },
  pool: pool,
};
