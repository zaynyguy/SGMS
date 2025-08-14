const db = require('../db');

// -------------------- GET ALL ROLES --------------------
exports.getAllRoles = async (req, res) => {
  try {
    const query = `
      SELECT r.id, r.name, r.description,
             COALESCE(json_agg(p.name) FILTER (WHERE p.name IS NOT NULL), '[]'::json) AS permissions
      FROM "Roles" r
      LEFT JOIN "RolePermissions" rp ON r.id = rp."roleId"
      LEFT JOIN "Permissions" p ON rp."permissionId" = p.id
      GROUP BY r.id
      ORDER BY r.id;
    `;
    const { rows } = await db.query(query);
    res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching roles:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

// -------------------- CREATE ROLE --------------------
exports.createRole = async (req, res) => {
  const { name, description, permissions } = req.body;
  if (!name || !Array.isArray(permissions)) {
    return res.status(400).json({ message: "Role name and permissions array are required." });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const roleResult = await client.query(
      'INSERT INTO "Roles" (name, description) VALUES ($1, $2) RETURNING id;',
      [name.trim(), description]
    );
    const newRoleId = roleResult.rows[0].id;

    if (permissions.length > 0) {
      const permPromises = permissions.map(permId =>
        client.query(
          'INSERT INTO "RolePermissions" ("roleId", "permissionId") VALUES ($1, $2);',
          [newRoleId, permId]
        )
      );
      await Promise.all(permPromises);
    }

    await client.query('COMMIT');
    res.status(201).json({
      message: "Role created successfully.",
      role: { id: newRoleId, name: name.trim() },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === "23505") {
      return res.status(409).json({ message: "A role with that name already exists." });
    }
    console.error("Error creating role:", error);
    res.status(500).json({ message: "Internal server error." });
  } finally {
    client.release();
  }
};

// -------------------- UPDATE ROLE --------------------
exports.updateRole = async (req, res) => {
  const { id } = req.params;
  const { name, description, permissions } = req.body;
  if (!name || !Array.isArray(permissions)) {
    return res.status(400).json({ message: "Role name and permissions array are required." });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const roleCheck = await client.query('SELECT name FROM "Roles" WHERE id = $1', [id]);
    if (roleCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: "Role not found." });
    }

    if (roleCheck.rows[0].name === 'Admin' && name.trim() !== 'Admin') {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: "The 'Admin' role cannot be renamed." });
    }

    await client.query(
      'UPDATE "Roles" SET name = $1, description = $2, "updatedAt" = NOW() WHERE id = $3;',
      [name.trim(), description, id]
    );

    await client.query('DELETE FROM "RolePermissions" WHERE "roleId" = $1;', [id]);

    if (permissions.length > 0) {
      const permPromises = permissions.map(permId =>
        client.query(
          'INSERT INTO "RolePermissions" ("roleId", "permissionId") VALUES ($1, $2);',
          [id, permId]
        )
      );
      await Promise.all(permPromises);
    }

    await client.query('COMMIT');
    res.status(200).json({ message: "Role updated successfully." });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === "23505") {
      return res.status(409).json({ message: `A role with the name '${name}' already exists.` });
    }
    console.error("Error updating role:", error);
    res.status(500).json({ message: "Internal server error." });
  } finally {
    client.release();
  }
};

// -------------------- DELETE ROLE --------------------
exports.deleteRole = async (req, res) => {
  const { id } = req.params;
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const roleResult = await client.query('SELECT name FROM "Roles" WHERE id = $1', [id]);
    if (roleResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: "Role not found." });
    }
    if (roleResult.rows[0].name === 'Admin') {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: "The 'Admin' role cannot be deleted." });
    }

    await client.query('DELETE FROM "Roles" WHERE id = $1', [id]);
    await client.query('COMMIT');
    res.status(200).json({ message: "Role deleted successfully." });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error deleting role:", error);
    res.status(500).json({ message: "Internal server error." });
  } finally {
    client.release();
  }
};
