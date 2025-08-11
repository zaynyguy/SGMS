const db = require('../db');

exports.getAllRoles = async (req, res) => {
  try {
    const query = `
      SELECT r.id, r.name, r.description,
        COALESCE(
          (SELECT json_agg(p.name)
           FROM "Permissions" p JOIN "RolePermissions" rp ON p.id = rp."permissionId"
           WHERE rp."roleId" = r.id),
          '[]'::json
        ) as permissions
      FROM "Roles" r ORDER BY r.id;`;
    const { rows } = await db.query(query);
    res.status(200).json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.createRole = async (req, res) => {
    const { name, description, permissions } = req.body;
    if (!name || !Array.isArray(permissions)) return res.status(400).json({ message: 'Role name and permissions are required.' });
  
    await db.query('BEGIN');
    try {
      const roleResult = await db.query('INSERT INTO "Roles" (name, description) VALUES ($1, $2) RETURNING id;', [name, description]);
      const newRoleId = roleResult.rows[0].id;
      if (permissions.length > 0) {
        for (const permId of permissions) {
          await db.query('INSERT INTO "RolePermissions" ("roleId", "permissionId") VALUES ($1, $2);', [newRoleId, permId]);
        }
      }
      await db.query('COMMIT');
      res.status(201).json({ message: 'Role created successfully', role: { id: newRoleId, name } });
    } catch (error) {
      await db.query('ROLLBACK');
      if (error.code === '23505') return res.status(409).json({ message: `A role with that name already exists.` });
      res.status(500).json({ message: 'Internal server error' });
    }
};

exports.updateRole = async (req, res) => {
  const { id } = req.params;
  const { name, description, permissions } = req.body;
  if (!name || !Array.isArray(permissions)) return res.status(400).json({ message: 'Role name and permissions are required.' });
  
  const roleCheck = await db.query('SELECT name FROM "Roles" WHERE id = $1', [id]);
  if (roleCheck.rows[0]?.name === 'Admin' && name !== 'Admin') {
      return res.status(403).json({ message: "The 'Admin' role cannot be renamed." });
  }

  await db.query('BEGIN');
  try {
    await db.query('UPDATE "Roles" SET name = $1, description = $2, "updatedAt" = NOW() WHERE id = $3;', [name, description, id]);
    await db.query('DELETE FROM "RolePermissions" WHERE "roleId" = $1;', [id]);
    if (permissions.length > 0) {
      for (const permId of permissions) {
        await db.query('INSERT INTO "RolePermissions" ("roleId", "permissionId") VALUES ($1, $2);', [id, permId]);
      }
    }
    await db.query('COMMIT');
    res.status(200).json({ message: 'Role updated successfully' });
  } catch (error) {
    await db.query('ROLLBACK');
    if (error.code === '23505') return res.status(409).json({ message: `A role with the name '${name}' already exists.` });
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.deleteRole = async (req, res) => {
  const { id } = req.params;
  try {
    const roleResult = await db.query('SELECT name FROM "Roles" WHERE id = $1', [id]);
    if (roleResult.rows[0]?.name === 'Admin') {
      return res.status(403).json({ message: "The 'Admin' role cannot be deleted." });
    }
    const { rowCount } = await db.query('DELETE FROM "Roles" WHERE id = $1', [id]);
    if (rowCount === 0) return res.status(404).json({ message: 'Role not found.' });
    res.status(200).json({ message: 'Role deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
};