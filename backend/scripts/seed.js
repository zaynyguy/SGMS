require("dotenv").config();
const fs = require("fs");
const path = require("path");
const db = require("../src/db");
const bcrypt = require("bcrypt");

async function run() {
  const client = await db.connect();
  try {
    await client.query("BEGIN");

    // reload schema
    const schemaSql = fs.readFileSync(
      path.join(__dirname, "schema.sql"),
      "utf-8"
    );
    await client.query(schemaSql);

    // roles
    const roleNames = ["Admin", "Manager", "User"];
    const roleIds = {};
    for (const r of roleNames) {
      const ins = await client.query(
        `INSERT INTO "Roles"(name) VALUES ($1) RETURNING id`,
        [r]
      );
      roleIds[r] = ins.rows[0].id;
    }

    // permissions
    // NOTE: added manage_gta and view_gta for the consolidated GTA permission model
    const perms = [
      "manage_users",
      "manage_roles",
      "manage_groups",
      "view_groups",
      "manage_goals",
      "manage_tasks",
      "manage_activities",
      "manage_gta",    
      "view_gta",      
      "submit_reports",
      "review_reports",
      "view_reports",
      "manage_reports",
      "upload_attachments",
      "manage_settings",
      "view_settings",
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

    // Grants
    // Admin gets everything
    await grant("Admin", perms);

    // Manager gets group & GTA management and report viewing/reviewing etc.
    await grant("Manager", [
      "view_groups",
      "manage_groups",
      "manage_gta",      
      "view_gta",
      "manage_reports",
      "view_reports",
      "review_reports",
      "upload_attachments",
      "view_settings",
      "view_analytics"
    ]);

    // User gets viewing / submitting rights within their groups
    await grant("User", [
      "view_reports",
      "submit_reports",
      "upload_attachments",
      "view_settings",
      "view_gta"         
    ]);

    // admin user
    const adminUser = process.env.ADMIN_USERNAME || "admin";
    const adminPass = process.env.ADMIN_PASSWORD || "admin123";
    const hash = await bcrypt.hash(adminPass, 10);
    const u = await client.query(
      `INSERT INTO "Users"(username, name, password, "roleId", "profilePicture")
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [adminUser, "System Admin", hash, roleIds["Admin"], "/uploads/admin.png"]
    );
    const adminId = u.rows[0].id;

    // create test group + goal/task/activity
    const g = await client.query(
      `INSERT INTO "Groups"(name, description) VALUES ($1,$2) RETURNING id`,
      ["Development Team", "Handles software development."]
    );
    const devGroupId = g.rows[0].id;

    // Insert a sample goal with an explicit weight to show it's supported (default is 100)
    const gl = await client.query(
      `INSERT INTO "Goals"(title, description, "groupId", "startDate", "endDate", status, progress, weight)
      VALUES ('Launch Feature X','Implement and release new feature.', $1, CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days','In Progress',25, 100)
      RETURNING id`,
      [devGroupId]
    );
    const goalId = gl.rows[0].id;

    const tk = await client.query(
      `INSERT INTO "Tasks"(title, description, "goalId", status, "assigneeId", "dueDate", progress, weight)
      VALUES ('Implement Login','Create login module with JWT.', $1, 'In Progress', $2, CURRENT_DATE + INTERVAL '10 days', 50, 40)
      RETURNING id`,
      [goalId, adminId]
    );
    const taskId = tk.rows[0].id;

    // Insert an activity with a weight and optional targetMetric example
    const ac = await client.query(
      `INSERT INTO "Activities"(title, description, "taskId", status, weight, "targetMetric", "currentMetric", "isDone")
      VALUES ('JWT Middleware','Build and test JWT auth middleware.', $1, 'In Progress', 20, $2, $3, false) RETURNING id`,
      [taskId, JSON.stringify({ linesOfCode: 1000 }), JSON.stringify({ linesOfCode: 200 })]
    );
    const activityId = ac.rows[0].id;

    // settings
    const settings = [
      { key: "reporting_active", value: true, description: "Enable or disable the report submission window." },
      { key: "resubmission_deadline_days", value: 7, description: "Number of days to resubmit a rejected report." },
      { key: "reporting_start_day", value: "Monday", description: "The day of the week the reporting period starts." },
      { key: "notification_email_enabled", value: true, description: "Enable or disable email notifications for the system." },
      { key: "dashboard_refresh_interval", value: 60, description: "The refresh interval in seconds for the dashboard data." },
      { key: "audit_retention_days", value: 365, description: "Number of days to retain audit logs." },
    ];
    for (const s of settings) {
      // Ensure we insert JSONB properly: stringify JS values before passing to query
      await client.query(
        `INSERT INTO "SystemSettings"(key, value, description) VALUES ($1, $2::jsonb, $3)`,
        [s.key, JSON.stringify(s.value), s.description]
      );
    }

    const r = await client.query(
      `INSERT INTO "Reports"("activityId","userId", narrative, status)
      VALUES ($1,$2,'Initial activity report.','Pending') RETURNING id`,
      [activityId, adminId]
    );
    const reportId = r.rows[0].id;

    await client.query(
      `INSERT INTO "Attachments"("reportId","fileName","filePath","fileType")
       VALUES ($1,$2,$3,$4)`,
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
