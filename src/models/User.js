const pool = require('../db/database');

class User {
  static async createUser(email, password) {
    const query = 'INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id';
    const values = [email, password];
    const result = await pool.query(query, values);
    return result.rows[0].id;
  }

  static async getUserByEmail(email) {
    const query = 'SELECT * FROM users WHERE email = $1';
    const result = await pool.query(query, [email]);
    return result.rows[0];
  }
}

module.exports = User;
