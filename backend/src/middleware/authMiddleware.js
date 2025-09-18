// src/middleware/authMiddleware.js
const jwt = require("jsonwebtoken");
require("dotenv").config();
const db = require("../db");

async function authenticateJWT(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing or invalid token" });
  }
  const token = auth.split(" ")[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: process.env.JWT_ISSUER || "my-app",
    });

    if (
      typeof payload.id !== "undefined" &&
      typeof payload.tokenVersion !== "undefined"
    ) {
      try {
        const { rows } = await db.query(
          'SELECT token_version FROM "Users" WHERE id=$1',
          [payload.id]
        );
        const currentVersion = rows[0] ? rows[0].token_version : null;
        if (
          currentVersion !== null &&
          Number(currentVersion) !== Number(payload.tokenVersion)
        ) {
          return res.status(401).json({ message: "Token revoked" });
        }
      } catch (dbErr) {
        console.error("DB error in authenticateJWT tokenVersion check", dbErr);
        return res.status(500).json({ message: "Internal server error" });
      }
    }

    req.user = payload;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token expired" });
    }
    return res.status(401).json({ message: "Invalid token" });
  }
}

function authorizePermissions(required) {
  return (req, res, next) => {
    const perms = req.user?.permissions || [];
    const ok = required.some((r) => perms.includes(r));
    if (!ok) return res.status(403).json({ message: "Forbidden" });
    next();
  };
}

module.exports = { authenticateJWT, authorizePermissions };
