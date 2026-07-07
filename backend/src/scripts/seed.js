const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
const db = require("../db");
const bcrypt = require("bcrypt");

async function upsertRole(client, name) {
  const { rows } = await client.query(
    `INSERT INTO "Roles" (name, description, "createdAt", "updatedAt")
     VALUES ($1, $2, NOW(), NOW())
     ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description, "updatedAt" = NOW()
     RETURNING id`,
    [name, `${name} role`],
  );
  return rows[0].id;
}

async function upsertPermission(client, name) {
  const { rows } = await client.query(
    `INSERT INTO "Permissions" (name, description, "createdAt", "updatedAt")
     VALUES ($1, $2, NOW(), NOW())
     ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description, "updatedAt" = NOW()
     RETURNING id`,
    [name, `${name} permission`],
  );
  return rows[0].id;
}

async function upsertRolePermission(client, roleId, permissionId) {
  await client.query(
    `INSERT INTO "RolePermissions" ("roleId", "permissionId", "createdAt", "updatedAt")
     VALUES ($1, $2, NOW(), NOW())
     ON CONFLICT ("roleId", "permissionId") DO NOTHING`,
    [roleId, permissionId],
  );
}

async function upsertUser(client, username, name, passwordHash, roleId) {
  await client.query(
    `INSERT INTO "Users" (username, name, password, "roleId", "profilePicture", "language", token_version, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, 'en', 0, NOW(), NOW())
     ON CONFLICT (username) DO UPDATE SET
       name = EXCLUDED.name,
       password = EXCLUDED.password,
       "roleId" = EXCLUDED."roleId",
       "profilePicture" = EXCLUDED."profilePicture",
       "updatedAt" = NOW()`,
    [username, name, passwordHash, roleId, "/uploads/admin.png"],
  );
}

async function upsertSystemSetting(client, key, value, description) {
  await client.query(
    `INSERT INTO "SystemSettings" (key, value, description, "createdAt", "updatedAt")
     VALUES ($1, $2::jsonb, $3, NOW(), NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, description = EXCLUDED.description, "updatedAt" = NOW()`,
    [key, JSON.stringify(value), description],
  );
}

async function run() {
  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const roleNames = ["Admin", "Manager", "User"];
    const roleIds = {};
    for (const role of roleNames) {
      roleIds[role] = await upsertRole(client, role);
    }

    const permissions = [
      "manage_gta",
      "view_gta",
      "submit_reports",
      "view_reports",
      "manage_reports",
      "manage_settings",
      "view_audit_logs",
      "manage_notifications",
      "manage_dashboard",
      "view_dashboard",
      "manage_attachments",
      "manage_access",
    ];
    const permissionIds = {};
    for (const permission of permissions) {
      permissionIds[permission] = await upsertPermission(client, permission);
    }

    async function grant(roleName, permissionNames) {
      const roleId = roleIds[roleName];
      if (!roleId) return;
      for (const permissionName of permissionNames) {
        const permissionId = permissionIds[permissionName];
        if (!permissionId) continue;
        await upsertRolePermission(client, roleId, permissionId);
      }
    }

    await grant("Admin", permissions);
    await grant("Manager", [
      "manage_gta",
      "view_gta",
      "manage_reports",
      "view_reports",
      "view_dashboard",
    ]);
    await grant("User", ["view_reports", "view_gta", "view_dashboard"]);

    const adminUser = process.env.ADMIN_USERNAME || "admin";
    const adminPass = process.env.ADMIN_PASSWORD || "admin123";
    const passwordHash = await bcrypt.hash(adminPass, 10);
    await upsertUser(
      client,
      adminUser,
      "System Admin",
      passwordHash,
      roleIds.Admin,
    );

    const settings = [
      {
        key: "max_attachment_size_mb",
        value: 10,
        description: "Max attachment upload size (MB)",
      },
      {
        key: "allowed_attachment_types",
        value: ["application/pdf", "image/png", "image/jpeg", "text/plain"],
        description: "Allowed MIME types",
      },
      {
        key: "reporting_active",
        value: true,
        description: "Enable report submissions",
      },
      {
        key: "audit_retention_days",
        value: 365,
        description: "Days to retain audit logs",
      },
    ];

    for (const setting of settings) {
      await upsertSystemSetting(
        client,
        setting.key,
        setting.value,
        setting.description,
      );
    }

    await client.query("COMMIT");
    console.log("Seeding completed successfully!");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error seeding DB:", err);
    process.exitCode = 1;
  } finally {
    client.release();
  }
}

run();
