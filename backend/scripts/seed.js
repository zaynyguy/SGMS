const db = require("../src/db");
const bcrypt = require("bcrypt");
require("dotenv").config();

async function seedDatabase() {
  console.log("🌱 Starting database seeding...");
  const client = await db.pool.connect();

  try {
    await client.query("BEGIN");

    // -------------------- ROLES --------------------
    await client.query(`
      INSERT INTO "Roles" (name, description)
      VALUES
        ('Admin', 'Full access to all features'),
        ('Manager', 'Can manage goals, tasks, activities, reports, and groups'),
        ('User', 'Limited access for regular users')
      ON CONFLICT (name) DO NOTHING;
    `);

    const rolesRes = await client.query(`SELECT id, name FROM "Roles";`);
    const roles = rolesRes.rows.reduce((acc, row) => {
      acc[row.name] = row.id;
      return acc;
    }, {});
    console.log("✅ Roles seeded:", roles);

    // -------------------- PERMISSIONS --------------------
    const permissionsToInsert = [
      ["manage_users", "Can manage users"],
      ["manage_roles", "Can manage roles"],
      ["manage_permissions", "Can manage permissions"],
      ["manage_groups", "Can manage groups & user assignments"],
      ["manage_goals", "Can manage goals"],
      ["manage_tasks", "Can manage tasks"],
      ["manage_activities", "Can manage activities"],
      ["manage_reports", "Can approve/reject reports"],
      ["manage_attachments", "Can delete/manage attachments"],
      ["submit_reports", "Can submit reports"],
      ["upload_attachments", "Can upload attachments"],
      ["view_users", "Can view users"],
      ["view_roles", "Can view roles"],
      ["view_permissions", "Can view permissions"],
      ["view_groups", "Can view groups"],
      ["view_goals", "Can view goals"],
      ["view_tasks", "Can view tasks"],
      ["view_activities", "Can view activities"],
      ["view_reports", "Can view reports"],
      ["view_attachments", "Can view attachments"],
      ["manage_settings", "Can manage system settings"],
      ["view_settings", "Can view system settings"],
    ];

    for (const [name, desc] of permissionsToInsert) {
      await client.query(
        `INSERT INTO "Permissions" (name, description)
         VALUES ($1, $2) ON CONFLICT (name) DO NOTHING;`,
        [name, desc]
      );
    }

    const permsRes = await client.query(`SELECT id, name FROM "Permissions";`);
    const permissions = permsRes.rows.reduce((acc, row) => {
      acc[row.name] = row.id;
      return acc;
    }, {});
    console.log("✅ Permissions seeded:", Object.keys(permissions));

    // -------------------- ROLE PERMISSIONS --------------------
    // Admin: all permissions
    for (const permId of Object.values(permissions)) {
      await client.query(
        `INSERT INTO "RolePermissions" ("roleId", "permissionId")
         VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
        [roles.Admin, permId]
      );
    }

    // Manager: manage groups, goals, tasks, activities, reports, and settings + view everything
    const managerPerms = [
      "manage_groups",
      "manage_goals",
      "manage_tasks",
      "manage_activities",
      "manage_reports",
      "submit_reports",
      "upload_attachments",
      "view_users",
      "view_roles",
      "view_groups",
      "view_goals",
      "view_tasks",
      "view_activities",
      "view_reports",
      "manage_settings",      
      "view_attachments",
      "view_settings",    
    ];
    for (const name of managerPerms) {
      if (permissions[name]) {
        await client.query(
          `INSERT INTO "RolePermissions" ("roleId", "permissionId")
           VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
          [roles.Manager, permissions[name]]
        );
      }
    }

    // User: minimal permissions
    const userPerms = [
      "view_tasks",
      "view_activities",
      "view_reports",
      "submit_reports",
      "upload_attachments",
      "view_settings", 
    ];
    for (const name of userPerms) {
      if (permissions[name]) {
        await client.query(
          `INSERT INTO "RolePermissions" ("roleId", "permissionId")
           VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
          [roles.User, permissions[name]]
        );
      }
    }
    console.log("✅ Role permissions assigned.");

    // -------------------- ADMIN USER --------------------
    const hashedPassword = await bcrypt.hash(
      process.env.ADMIN_PASSWORD || "admin123",
      10
    );
    const adminUsername = process.env.ADMIN_USERNAME || "admin";

    await client.query(
      `INSERT INTO "Users" (username, name, password, "roleId")
       VALUES ($1, $2, $3, $4) ON CONFLICT (username) DO NOTHING;`,
      [adminUsername, "System Admin", hashedPassword, roles.Admin]
    );

    const adminRes = await client.query(
      `SELECT id FROM "Users" WHERE username=$1`,
      [adminUsername]
    );
    const adminId = adminRes.rows[0].id;
    console.log(`✅ Admin user: ${adminUsername} (id=${adminId})`);

    // -------------------- SAMPLE GROUP --------------------
    await client.query(
      `INSERT INTO "Groups" (name, description)
       VALUES ('Development Team', 'Handles software development.')
       ON CONFLICT (name) DO NOTHING;`
    );

    const groupRes = await client.query(
      `SELECT id FROM "Groups" WHERE name='Development Team'`
    );
    const devGroupId = groupRes.rows[0].id;

    // -------------------- SAMPLE GOAL --------------------
    await client.query(
      `INSERT INTO "Goals" (title, description, "groupId", "startDate", "endDate", status, progress)
       VALUES ('Launch Feature X', 'Implement and release new feature.', $1, CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', 'In Progress', 25);`,
      [devGroupId]
    );
    const goalRes = await client.query(
      `SELECT id FROM "Goals" WHERE title='Launch Feature X'`
    );
    const goalId = goalRes.rows[0].id;

    // -------------------- SAMPLE TASK --------------------
    await client.query(
      `INSERT INTO "Tasks" (title, description, "goalId", status, "assigneeId", "dueDate", progress)
       VALUES ('Implement Login', 'Create login module with JWT.', $1, 'In Progress', $2, CURRENT_DATE + INTERVAL '10 days', 50);`,
      [goalId, adminId]
    );
    const taskRes = await client.query(
      `SELECT id FROM "Tasks" WHERE title='Implement Login'`
    );
    const taskId = taskRes.rows[0].id;

    // -------------------- SAMPLE ACTIVITY --------------------
    await client.query(
      `INSERT INTO "Activities" (title, description, "taskId", status)
       VALUES ('JWT Middleware', 'Build and test JWT auth middleware.', $1, 'In Progress');`,
      [taskId]
    );

    const activityRes = await client.query(
      `SELECT id FROM "Activities" WHERE title='JWT Middleware'`
    );
    const activityId = activityRes.rows[0].id;

    // -------------------- SYSTEM SETTINGS --------------------
    const settingsToInsert = [
      // Use native JavaScript types
      { key: "reporting_active", value: true, description: "Enable or disable the report submission window." },
      { key: "resubmission_deadline_days", value: 7, description: "Number of days to resubmit a rejected report." },
      { key: "reporting_start_day", value: "Monday", description: "The day of the week the reporting period starts." }
    ];

    for (const setting of settingsToInsert) {
      // Correctly format the string value as a JSON string literal for the database
      const valueToInsert = (typeof setting.value === 'string') ? JSON.stringify(setting.value) : setting.value;
      await client.query(
        `INSERT INTO "SystemSettings" (key, value, description)
         VALUES ($1, $2::jsonb, $3)
         ON CONFLICT (key) DO NOTHING;`,
        [setting.key, valueToInsert, setting.description]
      );
    }
    console.log("✅ System settings seeded.");

    // -------------------- SAMPLE REPORT --------------------
    await client.query(
      `INSERT INTO "Reports" ("activityId", "userId", narrative, status)
       VALUES ($1, $2, 'Initial activity report.', 'Pending');`,
      [activityId, adminId]
    );

    const reportRes = await client.query(
      `SELECT id FROM "Reports" WHERE "activityId"=$1`,
      [activityId]
    );
    const reportId = reportRes.rows[0].id;

    // -------------------- SAMPLE ATTACHMENT --------------------
    await client.query(
      `INSERT INTO "Attachments" ("reportId", "fileName", "filePath", "fileType")
       VALUES ($1, 'sample.png', '/uploads/sample.png', 'image/png');`,
      [reportId]
    );
    console.log("✅ Sample report and attachment seeded.");

    await client.query("COMMIT");
    console.log("🎉 Database seeded successfully!");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Seeding failed:", err);
  } finally {
    client.release();
  }
}

seedDatabase();