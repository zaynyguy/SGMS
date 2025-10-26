const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
const fs = require("fs");
const db = require("../db");
const bcrypt = require("bcrypt");

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function findSchema() {
  const candidates = [
    path.join(__dirname, "..", "db", "schema.sql"),
    path.join(__dirname, "..", "schema.sql"),
    path.join(__dirname, "schema.sql"),
  ];
  for (const p of candidates)
    if (fs.existsSync(p)) return fs.readFileSync(p, "utf8");
  throw new Error("schema.sql not found.");
}
async function findData() {
  const candidates = [
    path.join(__dirname, "..", "db", "data.sql"),
    path.join(__dirname, "..", "data.sql"),
    path.join(__dirname, "data.sql"),
  ];
  for (const p of candidates)
    if (fs.existsSync(p)) return fs.readFileSync(p, "utf8");
  throw new Error("schema.sql not found.");
}

async function run() {
  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const schemaSql = await findSchema();
    await client.query(schemaSql);

    // --- Roles ---
    const roleNames = ["Admin", "Manager", "User"];
    const roleIds = {};
    for (const r of roleNames) {
      const { rows } = await client.query(
        `INSERT INTO "Roles"(name, description) VALUES ($1, $2) RETURNING id`,
        [r, `${r} role`]
      );
      roleIds[r] = rows[0].id;
    }

    // --- Permissions ---
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
        `INSERT INTO "Permissions"(name, description) VALUES ($1, $2) RETURNING id`,
        [p, `${p} permission`]
      );
      permIds[p] = rows[0].id;
    }

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

    await grant("Admin", perms);
    await grant("Manager", [
      "manage_gta",
      "view_gta",
      "manage_reports",
      "view_reports",
      "view_dashboard",
    ]);
    await grant("User", ["view_reports", "view_gta", "view_dashboard"]);

    // --- Admin user ---
    const adminUser = process.env.ADMIN_USERNAME || "admin";
    const adminPass = process.env.ADMIN_PASSWORD || "admin123";
    const adminHash = await bcrypt.hash(adminPass, 10);
    const { rows: arows } = await client.query(
      `INSERT INTO "Users"(username, name, password, "roleId", "profilePicture")
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [
        adminUser,
        "System Admin",
        adminHash,
        roleIds["Admin"],
        "/uploads/admin.png",
      ]
    );

    // --- Groups ---
    const groupDefs = [
      { name: "Development", desc: "Dev team" },
      { name: "QA", desc: "Quality Assurance" },
      { name: "Operations", desc: "Ops & Infra" },
    ];
    const groupIds = [];
    for (const g of groupDefs) {
      const { rows } = await client.query(
        `INSERT INTO "Groups"(name, description) VALUES ($1, $2) RETURNING id`,
        [g.name, g.desc]
      );
      groupIds.push(rows[0].id);
    }

    // --- System settings ---
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
    console.log("Seeding completed successfully!");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error seeding DB:", err);
  } finally {
    client.release();
  }
}

run();
