const jwt = require('jsonwebtoken');
const env = require("dotenv");

env.config();

const secretKey = process.env.SECRET_KEY;

class JWT {
  static sign(payload) {
    return jwt.sign(payload, secretKey, { expiresIn: '30d' });
  }

  static verify(token) {
    return jwt.verify(token, secretKey);
  }
}

module.exports = JWT;
