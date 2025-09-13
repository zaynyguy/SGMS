// src/controllers/authController.js
const db = require("../db");
const bcrypt = require("bcrypt");
const generateToken = require("../utils/generateToken");
const { logAudit } = require("../helpers/audit");
const notificationService = require("../services/notificationService");

require("dotenv").config();

exports.login = async (req, res) => {
  let { username, password } = req.body;

  if (!username || !password) {
    return res
      .status(400)
      .json({ message: "Username and password are required." });
  }

  username = username.trim();
  password = password.trim();

  try {
    const { rows } = await db.query(
      `SELECT id, username, password FROM "Users" WHERE username = $1;`,
      [username]
    );

    // Dummy hash for timing attack prevention
    const dummyHash =
      "$2b$10$CwTycUXWue0Thq9StjUM0uJ8U8u3uGzqvMwBo4E0m.3zRJzj7G4z6"; // bcrypt hash of "dummyPassword"
    const user = rows[0] || {
      id: null,
      username: "unknown",
      password: dummyHash,
    };

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid || !rows.length) {
      try {
        await logAudit({
          userId: user.id || null,
          action: "USER_LOGIN_FAILED",
          entity: "Auth",
          entityId: null,
          details: { username },
          req,
        });
      } catch (e) {
        console.error("USER_LOGIN_FAILED audit failed:", e);
      }
      return res.status(401).json({ message: "Invalid username or password." });
    }

    const { token, user: payload } = await generateToken(user.id);

    // Post-login notification (best-effort)
    try {
      await notificationService({
        userId: user.id,
        type: "login",
        message: "You logged in successfully.",
        meta: {},
      });
    } catch (e) {
      console.error("Login notification failed", e);
    }

    try {
      await logAudit({
        userId: user.id,
        action: "USER_LOGIN_SUCCESS",
        entity: "Auth",
        entityId: null,
        details: { username },
        req,
      });
    } catch (e) {
      console.error("USER_LOGIN_SUCCESS audit failed:", e);
    }

    return res.status(200).json({
      message: "Login successful.",
      token,
      user: payload,
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};
