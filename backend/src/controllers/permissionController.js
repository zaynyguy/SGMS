// src/controllers/permissionController.js

const db = require('../db');

exports.getAllPermissions = async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT p.id, p.name, p.description,
              COALESCE(json_agg(r.name) FILTER (WHERE r.name IS NOT NULL), '[]'::json) AS roles
       FROM "Permissions" p
       LEFT JOIN "RolePermissions" rp ON p.id = rp."permissionId"
       LEFT JOIN "Roles" r ON rp."roleId" = r.id
       GROUP BY p.id
       ORDER BY p.name;`
    );

    res.status(200).json(rows);
  } catch (error) {
    console.error('Error fetching permissions:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
};
