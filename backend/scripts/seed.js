const db = require("../src/db");
const bcrypt = require("bcrypt");
require("dotenv").config();

async function seedDatabase() {
  console.log("Seeding database safely...");
  try {
    await db.query("BEGIN");

    // --- Roles ---
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

    // --- Permissions ---
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
      ["view_reports", "Can view reports"]
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

    // --- Admin User ---
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

    // --- Assign all permissions to Admin ---
    for (const permId of Object.values(permissions)) {
      await db.query(
        `INSERT INTO "RolePermissions" ("roleId", "permissionId")
         VALUES ($1, $2)
         ON CONFLICT ("roleId", "permissionId") DO NOTHING;`,
        [roles["Admin"], permId]
      );
    }

    // --- Groups ---
    const devGroupId = (await db.query(`
      INSERT INTO "Groups" (name, description)
      VALUES ('Development Team', 'Responsible for software development goals.')
      ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
      RETURNING id;
    `)).rows[0].id;

    const marketingGroupId = (await db.query(`
      INSERT INTO "Groups" (name, description)
      VALUES ('Marketing Team', 'Responsible for marketing and outreach goals.')
      ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
      RETURNING id;
    `)).rows[0].id;

    // --- Sample Users ---
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

    // --- Assign Users to Groups ---
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

    await db.query("COMMIT");
    console.log("✅ Database seeding completed successfully!");
  } catch (err) {
    await db.query("ROLLBACK");
    console.error("❌ Error seeding database:", err);
  }
}

seedDatabase();
