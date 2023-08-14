const bcrypt = require('bcrypt');
const jwt = require('../utils/jwt');
const User = require('../models/User');

class AuthService {
  static async register(email, password) {
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = await User.createUser(email, hashedPassword);
    return userId;
  }

  static async login(email, password) {
    const user = await User.getUserByEmail(email);
    if (!user) {
      throw new Error('User not found');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new Error('Invalid password');
    }

    const token = jwt.sign({ userId: user.id });
    return token;
  }
}

module.exports = AuthService;
