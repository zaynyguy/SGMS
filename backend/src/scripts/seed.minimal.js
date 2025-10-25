const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
const fs = require("fs");
const db = require("../db");
const bcrypt = require("bcrypt");



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




async function ensureRow(client, table, uniqueCol, values) {
  const cols = Object.keys(values);
  const params = cols.map((_, i) => `$${i + 1}`).join(", ");
  const insertSql = `INSERT INTO "${table}"(${cols.join(", ")}) VALUES (${params}) ON CONFLICT (${uniqueCol}) DO NOTHING RETURNING id`;
  const res = await client.query(insertSql, Object.values(values));
  if (res.rows.length) return res.rows[0].id;
  const sel = await client.query(`SELECT id FROM "${table}" WHERE ${uniqueCol} = $1`, [values[uniqueCol]]);
  return sel.rows[0].id;
}

async function run() {
  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const schemaSql = await findSchema();
    await client.query(schemaSql);

    const roleNames = ["Admin", "Manager", "User"];
    const roleIds = {};
    for (const r of roleNames) {
      const id = await ensureRow(client, "Roles", "name", { name: r, description: `${r} role` });
      roleIds[r] = id;
    }

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
      const id = await ensureRow(client, "Permissions", "name", { name: p, description: `${p} permission` });
      permIds[p] = id;
    }

    for (const roleName of ["Admin", "Manager", "User"]) {
      const rId = roleIds[roleName];
      const grantList =
        roleName === "Admin"
          ? perms
          : roleName === "Manager"
          ? ["manage_gta", "view_gta", "manage_reports", "view_reports", "view_dashboard"]
          : ["view_reports", "view_gta", "view_dashboard"];
      for (const perm of grantList) {
        const pId = permIds[perm];
        await client.query(
          `INSERT INTO "RolePermissions"("roleId","permissionId") VALUES ($1,$2) ON CONFLICT ("roleId","permissionId") DO NOTHING`,
          [rId, pId]
        );
      }
    }

    const adminUser = process.env.ADMIN_USERNAME || "admin";
    const adminPass = process.env.ADMIN_PASSWORD || "admin123";
    const adminHash = await bcrypt.hash(adminPass, 12);
    const adminInsert = await client.query(
      `INSERT INTO "Users"(username, name, password, "roleId") VALUES ($1,$2,$3,$4) ON CONFLICT (username) DO UPDATE SET name=EXCLUDED.name RETURNING id`,
      [adminUser, "System Admin", adminHash, roleIds["Admin"]]
    );
    const adminId = adminInsert.rows[0].id;

   

    const settings = [
      { key: "max_attachment_size_mb", value: 10, description: "Max attachment upload size (MB)" },
      { key: "allowed_attachment_types", value: ["application/pdf", "image/png", "image/jpeg", "text/plain"], description: "Allowed MIME types" },
      { key: "reporting_active", value: true, description: "Enable report submissions" },
      { key: "audit_retention_days", value: 365, description: "Days to retain audit logs" },
    ];

    for (const s of settings) {
      await client.query(
        `INSERT INTO "SystemSettings"(key, value, description) VALUES ($1,$2::jsonb,$3)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, description = EXCLUDED.description`,
        [s.key, JSON.stringify(s.value), s.description]
      );
    }

    await client.query("COMMIT");
    console.log(adminUser);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Minimal seed failed:", err);
    process.exitCode = 1;
  } finally {
    client.release();
  }
}

run();
