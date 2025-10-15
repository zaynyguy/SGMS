// src/controllers/roleController.js
const db = require('../db');

exports.getAllRoles = async (req, res) => {
  try {
    const query = `
      SELECT r.id, r.name, r.description,
        COALESCE(
          json_agg(p.name ORDER BY p.name) FILTER (WHERE p.name IS NOT NULL),
          '[]'::json
        ) AS permissions,
        r."createdAt", r."updatedAt"
      FROM "Roles" r
      LEFT JOIN "RolePermissions" rp ON rp."roleId" = r.id
      LEFT JOIN "Permissions" p ON rp."permissionId" = p.id
      GROUP BY r.id
      ORDER BY r.id;
    `;
    const { rows } = await db.query(query);
    res.status(200).json(rows);
  } catch (error) {
    console.error('roleController.getAllRoles error', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

exports.createRole = async (req, res) => {
  const { name, description, permissions } = req.body;
  if (!name || !Array.isArray(permissions)) {
    return res.status(400).json({ message: 'Role name and permissions array are required.' });
  }
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query('SELECT id FROM "Roles" WHERE name = $1', [name.trim()]);
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: `A role with the name '${name}' already exists.` });
    }

    const roleRes = await client.query(
      'INSERT INTO "Roles"(name, description, "createdAt", "updatedAt") VALUES($1,$2,NOW(),NOW()) RETURNING id, name, description',
      [name.trim(), description || null]
    );
    const roleId = roleRes.rows[0].id;

    if (permissions.length) {
      const promises = permissions.map(pid =>
        client.query('INSERT INTO "RolePermissions"("roleId","permissionId","createdAt","updatedAt") VALUES($1,$2,NOW(),NOW())', [roleId, pid])
      );
      await Promise.all(promises);
    }

    await client.query('COMMIT');

    const { rows } = await db.query(
      `SELECT r.id, r.name, r.description,
        COALESCE(json_agg(p.name ORDER BY p.name) FILTER (WHERE p.name IS NOT NULL), '[]'::json) AS permissions
       FROM "Roles" r
       LEFT JOIN "RolePermissions" rp ON rp."roleId" = r.id
       LEFT JOIN "Permissions" p ON rp."permissionId" = p.id
       WHERE r.id = $1
       GROUP BY r.id`,
      [roleId]
    );

    res.status(201).json({ message: 'Role created successfully.', role: rows[0] || roleRes.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK').catch(()=>{});
    console.error('roleController.createRole error', err);
    res.status(500).json({ message: 'Internal server error.' });
  } finally {
    client.release();
  }
};

exports.updateRole = async (req, res) => {
  const { id } = req.params;
  const { name, description, permissions } = req.body;
  if (!name || !Array.isArray(permissions)) {
    return res.status(400).json({ message: 'Role name and permissions array are required.' });
  }
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const roleCheck = await client.query('SELECT name FROM "Roles" WHERE id = $1', [id]);
    if (roleCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Role not found.' });
    }
    if (roleCheck.rows[0].name === 'Admin' && name.trim() !== 'Admin') {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: "The 'Admin' role cannot be renamed." });
    }

    await client.query('UPDATE "Roles" SET name=$1, description=$2, "updatedAt"=NOW() WHERE id=$3', [name.trim(), description || null, id]);

    await client.query('DELETE FROM "RolePermissions" WHERE "roleId" = $1', [id]);

    if (permissions.length) {
      const promises = permissions.map(pid =>
        client.query('INSERT INTO "RolePermissions"("roleId","permissionId","createdAt","updatedAt") VALUES($1,$2,NOW(),NOW())', [id, pid])
      );
      await Promise.all(promises);
    }

    await client.query('COMMIT');

    const { rows } = await db.query(
      `SELECT r.id, r.name, r.description,
        COALESCE(json_agg(p.name ORDER BY p.name) FILTER (WHERE p.name IS NOT NULL), '[]'::json) AS permissions
       FROM "Roles" r
       LEFT JOIN "RolePermissions" rp ON rp."roleId" = r.id
       LEFT JOIN "Permissions" p ON rp."permissionId" = p.id
       WHERE r.id = $1
       GROUP BY r.id`,
      [id]
    );

    res.status(200).json({ message: 'Role updated successfully.', role: rows[0] });
  } catch (err) {
    await client.query('ROLLBACK').catch(()=>{});
    console.error('roleController.updateRole error', err);
    res.status(500).json({ message: 'Internal server error.' });
  } finally {
    client.release();
  }
};

exports.deleteRole = async (req, res) => {
  const { id } = req.params;
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const roleCheck = await client.query('SELECT name FROM "Roles" WHERE id = $1', [id]);
    if (roleCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Role not found.' });
    }
    if (roleCheck.rows[0].name === 'Admin') {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: "The 'Admin' role cannot be deleted." });
    }
    await client.query('DELETE FROM "RolePermissions" WHERE "roleId" = $1', [id]);
    await client.query('DELETE FROM "Roles" WHERE id = $1', [id]);
    await client.query('COMMIT');
    res.status(200).json({ message: 'Role deleted successfully.' });
  } catch (err) {
    await client.query('ROLLBACK').catch(()=>{});
    console.error('roleController.deleteRole error', err);
    res.status(500).json({ message: 'Internal server error.' });
  } finally {
    client.release();
  }
};
