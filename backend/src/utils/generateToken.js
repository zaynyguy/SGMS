// src/utils/generateToken.js
const jwt = require('jsonwebtoken');
const db = require('../db');

const generateToken = async (userId, { expiresIn = '15m' } = {}) => {
  const query = `
    SELECT u.id, u.username, u.name, u."roleId", u.language, u."darkMode", u.token_version AS "tokenVersion", r.name AS "roleName"
    FROM "Users" u
    LEFT JOIN "Roles" r ON u."roleId" = r.id
    WHERE u.id = $1;
  `;
  const { rows } = await db.query(query, [userId]);
  const user = rows[0];
  if (!user) throw new Error('User not found');

  const permsQuery = `
    SELECT p.name AS permission
    FROM "Permissions" p
    JOIN "RolePermissions" rp ON p.id = rp."permissionId"
    WHERE rp."roleId" = $1;
  `;
  const permsResult = await db.query(permsQuery, [user.roleId]);
  const permissions = permsResult.rows.map(r => r.permission);

  const payload = {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.roleName,
    permissions,
    language: user.language,
    darkMode: user.darkMode,
    tokenVersion: user.tokenVersion || 0,
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || expiresIn,
    issuer: process.env.JWT_ISSUER || 'my-app',
    jwtid: String(user.id) + ':' + Date.now(), // optional simple jti
  });

  return { token, user: payload };
};

module.exports = generateToken;
