const db = require("../db");
const bcrypt = require("bcrypt");
const {
  generateRefreshTokenValue,
  hashToken,
  compareTokenHash,
} = require("../utils/refreshToken");
const generateToken = require("../utils/generateToken");
const { logAudit } = require("../helpers/audit");

const REFRESH_TOKEN_EXPIRES_DAYS = Number(
  process.env.REFRESH_TOKEN_EXPIRES_DAYS || 1,
);

async function login(req, res) {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ message: "Username and password required" });

  const { rows } = await db.query(
    'SELECT id, username, password FROM "Users" WHERE username = $1',
    [username],
  );
  const dummyHash =
    "$2b$10$CwTycUXWue0Thq9StjUM0uJ8U8u3uGzqvMwBo4E0m.3zRJzj7G4z6";
  const userRow = rows[0] || {
    id: null,
    username: "unknown",
    password: dummyHash,
  };

  const passwordOk = await bcrypt.compare(password, userRow.password);
  if (!passwordOk) {
    await logAudit({
      userId: userRow.id,
      action: "USER_LOGIN_FAILED",
      entity: "Auth",
      entityId: null,
      details: { username },
      req,
    }).catch(console.error);
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const { token: accessToken, user: payload } = await generateToken(
    userRow.id,
    { expiresIn: process.env.JWT_EXPIRES_IN || "15m" },
  );

  const refreshValue = generateRefreshTokenValue();
  const refreshHash = await hashToken(refreshValue);
  const expiresAt = new Date(
    Date.now() + REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
  );

  await db.query(
    'INSERT INTO "RefreshTokens" ("userId", token_hash, "expiresAt") VALUES ($1,$2,$3)',
    [userRow.id, refreshHash, expiresAt],
  );

  res.cookie("refreshToken", refreshValue, {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === "true",
    sameSite: "lax",
    maxAge: REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
  });

  await logAudit({
    userId: userRow.id,
    action: "USER_LOGIN_SUCCESS",
    entity: "Auth",
    entityId: null,
    details: { username },
    req,
  }).catch(console.error);

  return res
    .status(200)
    .json({ message: "Login successful.", token: accessToken, user: payload });
}

async function refreshToken(req, res) {
  const token = req.cookies?.refreshToken;
  if (!token) return res.status(401).json({ message: "No refresh token" });

  try {
    const rows = (
      await db.query(
        `SELECT id, "userId", token_hash, "expiresAt", revoked FROM "RefreshTokens" WHERE revoked = false`,
      )
    ).rows;
    const matching = await rows.reduce(async (accP, r) => {
      const acc = await accP;
      if (acc) return acc;
      if (new Date(r.expiresAt) < new Date()) return null;
      return (await compareTokenHash(token, r.token_hash)) ? r : null;
    }, Promise.resolve(null));

    if (!matching)
      return res.status(401).json({ message: "Invalid refresh token" });

    const { token: accessToken, user: payload } = await generateToken(
      matching.userId,
      { expiresIn: process.env.JWT_EXPIRES_IN || "15m" },
    );

    const newRefreshValue = generateRefreshTokenValue();
    const newRefreshHash = await hashToken(newRefreshValue);
    const newExpiresAt = new Date(
      Date.now() + REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
    );

    await db.query('UPDATE "RefreshTokens" SET revoked = true WHERE id = $1', [
      matching.id,
    ]);
    await db.query(
      'INSERT INTO "RefreshTokens" ("userId", token_hash, "expiresAt") VALUES ($1,$2,$3)',
      [matching.userId, newRefreshHash, newExpiresAt],
    );

    res.cookie("refreshToken", newRefreshValue, {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === "true",
      sameSite: "lax",
      maxAge: REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
    });
    return res.json({ token: accessToken, user: payload });
  } catch (err) {
    console.error("refreshToken error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
}

async function logout(req, res) {
  const token = req.cookies?.refreshToken;
  if (token) {
    const rows = (
      await db.query(
        'SELECT id, token_hash FROM "RefreshTokens" WHERE revoked = false',
      )
    ).rows;
    for (const r of rows) {
      if (await compareTokenHash(token, r.token_hash)) {
        await db.query(
          'UPDATE "RefreshTokens" SET revoked = true WHERE id = $1',
          [r.id],
        );
        break;
      }
    }
  }
  res.clearCookie("refreshToken");
  return res.json({ message: "Logged out" });
}

module.exports = { login, refreshToken, logout };
