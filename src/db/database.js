const { Pool } = require("pg");
const env = require("dotenv");

env.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

module.exports = pool;
