// src/controllers/usersController.js

const db = require('../db');
const bcrypt = require('bcrypt');

exports.getAllUsers = async (req, res) => {
  const { rows } = await db.query(`
    SELECT u.id, u.username, u.name, u."roleId", r.name AS role, u.language, u."darkMode"
    FROM "Users" u LEFT JOIN "Roles" r ON u."roleId"=r.id
    ORDER BY u."createdAt" DESC`);
  res.json(rows);
};

exports.createUser = async (req, res) => {
  const { username, name, password, roleId, language, darkMode } = req.body;
  const hash = await bcrypt.hash(password, 10);
  const r = await db.query(
    `INSERT INTO "Users"(username, name, password, "roleId", language, "darkMode")
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, username, name, "roleId", language, "darkMode"`,
    [username.trim(), name?.trim() || null, hash, roleId || null, language || 'en', !!darkMode]
  );
  res.status(201).json(r.rows[0]);
};

exports.updateUser = async (req, res) => {
  const { id } = req.params;
  const { name, password, roleId, language, darkMode } = req.body;
  let hash = null;
  if (password) hash = await bcrypt.hash(password, 10);
  const r = await db.query(
    `UPDATE "Users" SET name=COALESCE($1,name), password=COALESCE($2,password),
     "roleId"=COALESCE($3,"roleId"), language=COALESCE($4,language), "darkMode"=COALESCE($5,"darkMode"), "updatedAt"=NOW()
     WHERE id=$6 RETURNING id, username, name, "roleId", language, "darkMode"`,
    [name?.trim() || null, hash, roleId || null, language || null, darkMode, id]
  );
  res.json(r.rows[0]);
};

exports.deleteUser = async (req, res) => {
  const { id } = req.params;
  await db.query('DELETE FROM "Users" WHERE id=$1', [id]);
  res.json({ message: 'User deleted.' });
};
