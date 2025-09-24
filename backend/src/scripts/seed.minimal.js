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


function snapshotMonthFrom(date) {
  const d = new Date(date);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
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
      `INSERT INTO "Users"(username, name, password, "roleId", "profilePicture") VALUES ($1,$2,$3,$4,$5) ON CONFLICT (username) DO UPDATE SET name=EXCLUDED.name RETURNING id`,
      [adminUser, "System Admin", adminHash, roleIds["Admin"], "/uploads/admin.png"]
    );
    const adminId = adminInsert.rows[0].id;

    const groupRes = await client.query(
      `INSERT INTO "Groups"(name, description) VALUES ($1,$2) ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description RETURNING id`,
      ["Development Team", "Team handling core development"]
    );
    const devGroupId = groupRes.rows[0].id;

    await client.query(`INSERT INTO "UserGroups"("userId","groupId") VALUES ($1,$2) ON CONFLICT ("userId","groupId") DO NOTHING`, [
      adminId,
      devGroupId,
    ]);

    const goalRes = await client.query(
      `INSERT INTO "Goals"(title, description, "groupId", "startDate", "endDate", status, progress, weight)
       VALUES ($1,$2,$3,CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days','In Progress', 10, 100)
       RETURNING id`,
      ["Initial Goal", "A small seeded goal", devGroupId]
    );
    const goalId = goalRes.rows[0].id;

    const taskRes = await client.query(
      `INSERT INTO "Tasks"(title, description, "goalId", status, "assigneeId", "dueDate", progress, weight)
       VALUES ($1,$2,$3,'To Do',$4,CURRENT_DATE + INTERVAL '10 days', 0, 50)
       RETURNING id`,
      ["Initial Task", "First seed task", goalId, adminId]
    );
    const taskId = taskRes.rows[0].id;

    const activityRes = await client.query(
      `INSERT INTO "Activities"(title, description, "taskId", status, weight, "targetMetric", "currentMetric", "isDone", "dueDate")
       VALUES ($1,$2,$3,'To Do',50,$4,$5,false, CURRENT_DATE + INTERVAL '9 days')
       RETURNING id`,
      ["Initial Activity", "First seeded activity", taskId, JSON.stringify({ target: "any" }), JSON.stringify({ current: "none" })]
    );
    const activityId = activityRes.rows[0].id;

    const now = new Date();
    const snapshot = snapshotMonthFrom(now);

    await client.query(
      `INSERT INTO "ProgressHistory"(entity_type, entity_id, group_id, progress, recorded_at, snapshot_month)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (entity_type, entity_id, snapshot_month)
       DO UPDATE SET progress = EXCLUDED.progress, recorded_at = EXCLUDED.recorded_at, metrics = EXCLUDED.metrics`,
      ["Task", taskId, devGroupId, 0, now, snapshot]
    );

    await client.query(
      `INSERT INTO "ProgressHistory"(entity_type, entity_id, group_id, progress, recorded_at, snapshot_month)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (entity_type, entity_id, snapshot_month)
       DO UPDATE SET progress = EXCLUDED.progress, recorded_at = EXCLUDED.recorded_at, metrics = EXCLUDED.metrics`,
      ["Activity", activityId, devGroupId, 0, now, snapshot]
    );

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
