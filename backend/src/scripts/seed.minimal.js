// src/scripts/seed.minimal.js

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
const fs = require("fs");
const db = require("../db"); // adjust path if needed
const bcrypt = require("bcrypt");

async function findSchema() {
  const candidates = [
    path.join(__dirname, "..", "db", "schema.sql"),
    path.join(__dirname, "..", "schema.sql"),
    path.join(__dirname, "schema.sql"),
    path.join(__dirname, "..", "db", "schema.sql"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return fs.readFileSync(p, "utf8");
  }
  throw new Error("schema.sql not found in expected locations.");
}

async function run() {
  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const schemaSql = await findSchema();
    console.log("Applying schema (will drop/create) ...");
    await client.query(schemaSql);

    // Roles
    const roleNames = ["Admin", "Manager", "User"];
    const roleIds = {};
    for (const r of roleNames) {
      const { rows } = await client.query(
        `INSERT INTO "Roles"(name, description) VALUES ($1,$2) RETURNING id`,
        [r, `${r} role`]
      );
      roleIds[r] = rows[0].id;
    }

    // Full permission set (keeps feature parity)
    const perms = [
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
    const permIds = {};
    for (const p of perms) {
      const { rows } = await client.query(
        `INSERT INTO "Permissions"(name, description) VALUES ($1,$2) RETURNING id`,
        [p, `${p} permission`]
      );
      permIds[p] = rows[0].id;
    }

    // Grant helper
    async function grant(roleName, arr) {
      const rId = roleIds[roleName];
      if (!rId) return;
      for (const name of arr) {
        const pid = permIds[name];
        if (!pid) continue;
        await client.query(
          `INSERT INTO "RolePermissions"("roleId","permissionId") VALUES ($1,$2) ON CONFLICT DO NOTHING`,
          [rId, pid]
        );
      }
    }

    // Grants: admin gets all; manager basic; user limited
    await grant("Admin", perms);
    await grant("Manager", [
      "manage_gta",
      "view_gta",
      "manage_reports",
      "view_reports",
      "view_dashboard",
    ]);
    await grant("User", ["view_reports", "view_gta", "view_dashboard"]);

    // Admin user
    const adminUser = process.env.ADMIN_USERNAME || "admin";
    const adminPass = process.env.ADMIN_PASSWORD || "admin123";
    const hash = await bcrypt.hash(adminPass, 10);
    const { rows: urows } = await client.query(
      `INSERT INTO "Users"(username, name, password, "roleId", "profilePicture")
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [adminUser, "System Admin", hash, roleIds["Admin"], "/uploads/admin.png"]
    );
    const adminId = urows[0].id;

    // One sample group
    const { rows: grows } = await client.query(
      `INSERT INTO "Groups"(name, description) VALUES ($1,$2) RETURNING id`,
      ["Development Team", "Team handling core development"]
    );
    const devGroupId = grows[0].id;

    // Attach admin to group
    await client.query(
      `INSERT INTO "UserGroups"("userId","groupId") VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [adminId, devGroupId]
    );

    // Minimal sample goal/task/activity (light)
    const { rows: gl } = await client.query(
      `INSERT INTO "Goals"(title, description, "groupId", startDate, endDate, status, progress, weight)
       VALUES ($1,$2,$3,CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days','In Progress', 10, 100) RETURNING id`,
      ["Initial Goal", "A small seeded goal", devGroupId]
    );
    const goalId = gl[0].id;

    const { rows: t } = await client.query(
      `INSERT INTO "Tasks"(title, description, "goalId", status, "assigneeId", "dueDate", progress, weight)
       VALUES ($1,$2,$3,'To Do',$4,CURRENT_DATE + INTERVAL '10 days', 0, 50) RETURNING id`,
      ["Initial Task", "First seed task", goalId, adminId]
    );
    const taskId = t[0].id;

    await client.query(
      `INSERT INTO "Activities"(title, description, "taskId", status, weight, targetMetric, currentMetric, isDone)
       VALUES ($1,$2,$3,'To Do',50,$4,$5,false)`,
      [
        "Initial Activity",
        "First seeded activity",
        taskId,
        JSON.stringify({ target: "any" }),
        JSON.stringify({ current: "none" }),
      ]
    );

    // Basic system settings
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

    for (const s of settings) {
      await client.query(
        `INSERT INTO "SystemSettings"(key, value, description) VALUES ($1,$2::jsonb,$3)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, description = EXCLUDED.description`,
        [s.key, JSON.stringify(s.value), s.description]
      );
    }

    await client.query("COMMIT");
    console.log(
      "Minimal seed complete. Admin user:",
      adminUser,
      "(password from env or admin123)"
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Minimal seed failed:", err);
    process.exitCode = 1;
  } finally {
    client.release();
  }
}

run();
