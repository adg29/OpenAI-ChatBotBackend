const jwt = require("../utils/jwt");

function authMiddleware(req, res, next) {
  const token = req.header("Authorization");

  if (!token) {
    return res.status(401).json({ message: "Authorization token missing" });
  }

  try {
    const bearerToken = token.split(" ")[1];
    const payload = jwt.verify(bearerToken);
    req.userId = payload.userId;
    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid token" });
  }
}

module.exports = authMiddleware;
