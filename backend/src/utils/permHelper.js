// src/utils/permHelper.js

const db = require('../db');

function hasPermission(user, perm) {
  if (!user || !Array.isArray(user.permissions)) return false;
  return user.permissions.includes(perm);
}

// returns array of groupIds the user belongs to
async function getUserGroupIds(user) {
  if (!user) return [];
  if (Array.isArray(user.groups) && user.groups.length) return user.groups.map(Number);
  // fallback to DB
  const { rows } = await db.query('SELECT "groupId" FROM "UserGroups" WHERE "userId" = $1', [user.id]);
  return rows.map(r => r.groupId);
}

module.exports = { hasPermission, getUserGroupIds };
