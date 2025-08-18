const db = require('../src/db');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function seedDatabase() {
  console.log("🌱 Starting database seed...");

  try {
    await db.query("BEGIN");

    // --- ROLES ---
    const roles = {};
    const roleInsert = await db.query(`
      INSERT INTO "Roles" (name, description)
      VALUES 
        ('Admin', 'Has all permissions.'),
        ('Manager', 'Can manage groups, goals, tasks, and activities.'),
        ('User', 'Can view and update their own items.')
      ON CONFLICT (name) DO NOTHING
      RETURNING id, name;
    `);

    for (const r of roleInsert.rows) roles[r.name] = r.id;

    for (const roleName of ["Admin", "Manager", "User"]) {
      if (!roles[roleName]) {
        const res = await db.query(`SELECT id FROM "Roles" WHERE name = $1`, [roleName]);
        roles[roleName] = res.rows[0].id;
      }
    }

    // --- PERMISSIONS ---
    const permissionsList = [
      ["view_dashboard", "Can view the main dashboard"],
      ["manage_project", "Full control over all project-related features"],
      ["manage_users", "Full control over users"],
      ["manage_roles", "Full control over roles and permissions"],
      ["manage_groups", "Full control over groups"],
      ["manage_goals", "Full control over all goals"],
      ["manage_tasks", "Full control over all tasks"],
      ["manage_activities", "Full control over all activities"],
      ["view_goals", "Can view goals"],
      ["view_tasks", "Can view tasks"],
      ["view_activities", "Can view activities"],
      ["view_reports", "Can view reports"],
      ["manage_reports", "Approve or reject reports"],
      ["manage_settings", "Update system-wide settings"]
    ];

    for (const [name, desc] of permissionsList) {
      await db.query(
        `INSERT INTO "Permissions" (name, description)
         VALUES ($1, $2)
         ON CONFLICT (name) DO NOTHING;`,
        [name, desc]
      );
    }

    const permissions = {};
    const allPerms = await db.query(`SELECT id, name FROM "Permissions"`);
    for (const p of allPerms.rows) permissions[p.name] = p.id;

    // --- ADMIN USER ---
    const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
    const adminUserRes = await db.query(
      `INSERT INTO "Users" (username, name, password, "roleId")
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (username) DO NOTHING
       RETURNING id;`,
      [process.env.ADMIN_USERNAME, "Administrator", hashedPassword, roles["Admin"]]
    );

    const adminUserId =
      adminUserRes.rows[0]?.id ||
      (await db.query(`SELECT id FROM "Users" WHERE username=$1`, [process.env.ADMIN_USERNAME])).rows[0].id;

    // --- ASSIGN ALL PERMISSIONS TO ADMIN ---
    for (const permId of Object.values(permissions)) {
      await db.query(
        `INSERT INTO "RolePermissions" ("roleId", "permissionId")
         VALUES ($1, $2)
         ON CONFLICT ("roleId", "permissionId") DO NOTHING;`,
        [roles["Admin"], permId]
      );
    }

    // --- GROUPS ---
    const devGroupId = (await db.query(`
      INSERT INTO "Groups" (name, description)
      VALUES ('Development Team', 'Responsible for software development goals.')
      ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description
      RETURNING id;
    `)).rows[0].id;

    const marketingGroupId = (await db.query(`
      INSERT INTO "Groups" (name, description)
      VALUES ('Marketing Team', 'Responsible for marketing and outreach goals.')
      ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description
      RETURNING id;
    `)).rows[0].id;

    // --- SAMPLE USERS ---
    const managerPass = await bcrypt.hash("password", 10);
    const managerId = (await db.query(
      `INSERT INTO "Users" (username, name, password, "roleId")
       VALUES ('manager', 'Dev Manager', $1, $2)
       ON CONFLICT (username) DO UPDATE SET name = EXCLUDED.name
       RETURNING id;`,
      [managerPass, roles["Manager"]]
    )).rows[0].id;

    const userPass = await bcrypt.hash("password", 10);
    const dev1Id = (await db.query(
      `INSERT INTO "Users" (username, name, password, "roleId")
       VALUES ('dev1', 'Developer One', $1, $2)
       ON CONFLICT (username) DO UPDATE SET name = EXCLUDED.name
       RETURNING id;`,
      [userPass, roles["User"]]
    )).rows[0].id;

    const marketerId = (await db.query(
      `INSERT INTO "Users" (username, name, password, "roleId")
       VALUES ('marketer1', 'Marketer One', $1, $2)
       ON CONFLICT (username) DO UPDATE SET name = EXCLUDED.name
       RETURNING id;`,
      [userPass, roles["User"]]
    )).rows[0].id;

    // --- USER GROUPS ---
    const userGroups = [
      [managerId, devGroupId],
      [dev1Id, devGroupId],
      [marketerId, marketingGroupId],
    ];
    for (const [uid, gid] of userGroups) {
      await db.query(
        `INSERT INTO "UserGroups" ("userId", "groupId")
         VALUES ($1, $2)
         ON CONFLICT ("userId", "groupId") DO NOTHING;`,
        [uid, gid]
      );
    }

    // --- SYSTEM SETTINGS ---
    const settings = [
      ['reporting_active', 'false', 'Enable or disable the periodic reporting window.'],
      ['reporting_start_day', '25', 'The day of the month the reporting window opens.'],
      ['reporting_end_day', '28', 'The day of the month the reporting window closes.'],
      ['resubmission_deadline_days', '2', 'How many days a user has to resubmit a rejected report.']
    ];
    for (const [key, value, description] of settings) {
      await db.query(
        `INSERT INTO "SystemSettings" (key, value, description)
         VALUES ($1, $2, $3)
         ON CONFLICT (key) DO NOTHING;`,
        [key, value, description]
      );
    }

    await db.query("COMMIT");
    console.log("✅ Database seeding completed successfully!");
  } catch (err) {
    await db.query("ROLLBACK");
    console.error("❌ Error seeding database:", err);
  }
}

seedDatabase();
