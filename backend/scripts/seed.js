require("dotenv").config();
const fs = require("fs");
const path = require("path");
const db = require("../src/db");
const bcrypt = require("bcrypt");

async function run() {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const schemaSql = fs.readFileSync(
      path.join(__dirname, "schema.sql"),
      "utf-8"
    );
    await client.query(schemaSql);

    const roleNames = ["Admin", "Manager", "User"];
    const roleIds = {};
    for (const r of roleNames) {
      const ins = await client.query(
        `INSERT INTO "Roles"(name) VALUES ($1) RETURNING id`,
        [r]
      );
      roleIds[r] = ins.rows[0].id;
    }

    const perms = [
      // Users & Roles
      "manage_users",
      "manage_roles",
      "manage_groups",
      "view_groups",

      // Goals / Tasks / Activities
      "manage_goals",
      "manage_tasks",
      "manage_activities",

      // Reports
      "submit_reports",
      "review_reports",
      "view_reports",
      "manage_reports",

      // Attachments
      "upload_attachments",

      // Settings
      "manage_settings",
      "view_settings",

      // Phase 3 extras
      "view_audit_logs",
      "manage_notifications",
      "view_analytics",
      "manage_analytics",
    ];

    const permIds = {};
    for (const p of perms) {
      const ins = await client.query(
        `INSERT INTO "Permissions"(name) VALUES ($1) RETURNING id`,
        [p]
      );
      permIds[p] = ins.rows[0].id;
    }

    async function grant(role, arr) {
      for (const p of arr) {
        await client.query(
          `INSERT INTO "RolePermissions"("roleId","permissionId") VALUES ($1,$2)`,
          [roleIds[role], permIds[p]]
        );
      }
    }
    await grant("Admin", perms);
    await grant("Manager", [
      "view_groups",
      "manage_groups",
      "manage_goals",
      "manage_tasks",
      "manage_activities",
      "view_reports",
      "review_reports",
      "upload_attachments",
      "view_settings",
    ]);
    await grant("User", [
      "view_reports",
      "submit_reports",
      "upload_attachments",
      "view_settings",
    ]);

    const adminUser = process.env.ADMIN_USERNAME || "admin";
    const adminPass = process.env.ADMIN_PASSWORD || "admin123";
    const hash = await bcrypt.hash(adminPass, 10);
    const u = await client.query(
      `INSERT INTO "Users"(username, name, password, "roleId")
      VALUES ($1,$2,$3,$4) RETURNING id`,
      [adminUser, "System Admin", hash, roleIds["Admin"]]
    );
    const adminId = u.rows[0].id;

    const g = await client.query(
      `INSERT INTO "Groups"(name, description) VALUES ($1,$2) RETURNING id`,
      ["Development Team", "Handles software development."]
    );
    const devGroupId = g.rows[0].id;

    const gl = await client.query(
      `INSERT INTO "Goals"(title, description, "groupId", "startDate", "endDate", status, progress)
      VALUES ('Launch Feature X','Implement and release new feature.', $1, CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days','In Progress',25)
      RETURNING id`,
      [devGroupId]
    );
    const goalId = gl.rows[0].id;

    const tk = await client.query(
      `INSERT INTO "Tasks"(title, description, "goalId", status, "assigneeId", "dueDate", progress)
      VALUES ('Implement Login','Create login module with JWT.', $1, 'In Progress', $2, CURRENT_DATE + INTERVAL '10 days', 50)
      RETURNING id`,
      [goalId, adminId]
    );
    const taskId = tk.rows[0].id;

    const ac = await client.query(
      `INSERT INTO "Activities"(title, description, "taskId", status)
      VALUES ('JWT Middleware','Build and test JWT auth middleware.', $1, 'In Progress') RETURNING id`,
      [taskId]
    );
    const activityId = ac.rows[0].id;

    const settings = [
      {
        key: "reporting_active",
        value: true,
        description: "Enable or disable the report submission window.",
      },
      {
        key: "resubmission_deadline_days",
        value: 7,
        description: "Number of days to resubmit a rejected report.",
      },
      {
        key: "reporting_start_day",
        value: "Monday",
        description: "The day of the week the reporting period starts.",
      },
      {
        key: "notification_email_enabled",
        value: true,
        description: "Enable or disable email notifications for the system.",
      },
      {
        key: "dashboard_refresh_interval",
        value: 60,
        description: "The refresh interval in seconds for the dashboard data.",
      },
      {
        key: "audit_retention_days",
        value: 365,
        description: "Number of days to retain audit logs.",
      },
    ];
    for (const s of settings) {
      const val =
        typeof s.value === "string" ? JSON.stringify(s.value) : s.value;
      await client.query(
        `INSERT INTO "SystemSettings"(key, value, description) VALUES ($1, $2::jsonb, $3)`,
        [s.key, val, s.description]
      );
    }

    const r = await client.query(
      `INSERT INTO "Reports"("activityId","userId", narrative, status)
      VALUES ($1,$2,'Initial activity report.','Pending') RETURNING id`,
      [activityId, adminId]
    );
    const reportId = r.rows[0].id;
    await client.query(
      `INSERT INTO "Attachments"("reportId","fileName","filePath","fileType") VALUES ($1,$2,$3,$4)`,
      [reportId, "sample.txt", "/uploads/sample.txt", "text/plain"]
    );

    await client.query("COMMIT");
    console.log("Seed complete.");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("Seed failed", e);
  } finally {
    client.release();
  }
}

run();
