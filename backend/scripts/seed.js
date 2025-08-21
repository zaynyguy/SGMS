// File: backend/seed.js
const db = require("./src/db"); // Ensure this path is correct based on your project structure
const bcrypt = require("bcrypt");
require("dotenv").config(); // Load environment variables (ADMIN_USERNAME, ADMIN_PASSWORD)

/**
 * Seeds the database with initial roles, permissions, an admin user, and sample data.
 * It uses ON CONFLICT DO NOTHING to ensure idempotency, meaning it can be run
 * multiple times without creating duplicate records if they already exist.
 */
async function seedDatabase() {
  console.log("Starting database seeding...");
  const client = await db.pool.connect(); // Use pool.connect() for transactions

  try {
    await client.query("BEGIN"); // Start a transaction for atomicity

    // --- 1. Seed Roles ---
    // Ensure 'Admin', 'Manager', 'User' roles exist.
    await client.query(`
      INSERT INTO "Roles" (name, description)
      VALUES
        ('Admin', 'System administrator with full access.'),
        ('Manager', 'Manages goals, tasks, and reports within assigned groups.'),
        ('User', 'Regular user, can view and update their assigned items.')
      ON CONFLICT (name) DO NOTHING;
    `);
    const rolesResult = await client.query(
      `SELECT id, name FROM "Roles" WHERE name IN ('Admin', 'Manager', 'User');`
    );
    const roles = rolesResult.rows.reduce((acc, curr) => {
      acc[curr.name] = curr.id;
      return acc;
    }, {});
    console.log("Seeded/Fetched Roles:", roles);

    // --- 2. Seed Permissions ---
    // Define core system permissions.
    await client.query(`
      INSERT INTO "Permissions" (name, description)
      VALUES
        ('manage:users', 'Allows creating, viewing, updating, and deleting all users.'),
        ('manage:roles', 'Allows creating, viewing, updating, and deleting all roles and their permissions.'),
        ('manage:groups', 'Allows creating, viewing, updating, and deleting groups.'),
        ('manage:goals', 'Allows creating, viewing, updating, and deleting all goals.'),
        ('manage:tasks', 'Allows creating, viewing, updating, and deleting all tasks and activities.'),
        ('manage:reports', 'Allows viewing, approving, and rejecting all reports.'),
        ('view:dashboard', 'Allows access to the main system dashboard and analytics.'),
        ('view:all_users', 'Allows viewing all users in the system.'),
        ('view:all_roles', 'Allows viewing all roles and their permissions.'),
        ('view:all_goals', 'Allows viewing all goals in the system.'),
        ('view:all_tasks', 'Allows viewing all tasks and activities in the system.'),
        ('view:all_reports', 'Allows viewing all reports in the system.'),
        ('submit:reports', 'Allows submitting reports for activities.'),
        ('update:own_tasks', 'Allows updating status/progress of assigned tasks.'),
        ('update:own_activities', 'Allows updating status/progress of assigned activities.')
      ON CONFLICT (name) DO NOTHING;
    `);
    const permsResult = await client.query(
      `SELECT id, name FROM "Permissions";`
    );
    const permissions = permsResult.rows.reduce((acc, curr) => {
      acc[curr.name] = curr.id;
      return acc;
    }, {});
    console.log("Seeded/Fetched Permissions:", Object.keys(permissions));

    // --- 3. Assign Permissions to Roles (Idempotent) ---
    // Admin role gets all permissions.
    const adminPermissions = Object.values(permissions);
    for (const permId of adminPermissions) {
      await client.query(
        `
        INSERT INTO "RolePermissions" ("roleId", "permissionId")
        VALUES ($1, $2)
        ON CONFLICT ("roleId", "permissionId") DO NOTHING;
      `,
        [roles["Admin"], permId]
      );
    }

    // Manager role gets specific permissions.
    const managerPermissions = [
      permissions["manage:goals"],
      permissions["manage:tasks"],
      permissions["manage:reports"],
      permissions["view:dashboard"],
      permissions["view:all_goals"],
      permissions["view:all_tasks"],
      permissions["view:all_reports"],
      permissions["view:all_users"], // Managers might need to see users to assign tasks
      permissions["submit:reports"],
    ].filter(Boolean); // Filter out any undefined if a permission name isn't found
    for (const permId of managerPermissions) {
      await client.query(
        `
        INSERT INTO "RolePermissions" ("roleId", "permissionId")
        VALUES ($1, $2)
        ON CONFLICT ("roleId", "permissionId") DO NOTHING;
      `,
        [roles["Manager"], permId]
      );
    }

    // User role gets basic permissions.
    const userPermissions = [
      permissions["view:dashboard"],
      permissions["update:own_tasks"],
      permissions["update:own_activities"],
      permissions["submit:reports"],
    ].filter(Boolean);
    for (const permId of userPermissions) {
      await client.query(
        `
        INSERT INTO "RolePermissions" ("roleId", "permissionId")
        VALUES ($1, $2)
        ON CONFLICT ("roleId", "permissionId") DO NOTHING;
      `,
        [roles["User"], permId]
      );
    }
    console.log("Assigned Permissions to Roles.");

    // --- 4. Seed Admin User ---
    const hashedPassword = await bcrypt.hash(
      process.env.ADMIN_PASSWORD || "admin123",
      10
    );
    const adminUsername = process.env.ADMIN_USERNAME || "admin";

    await client.query(
      `
      INSERT INTO "Users" (username, name, password, "roleId", language, "darkMode")
      VALUES ($1, $2, $3, $4, 'en', FALSE)
      ON CONFLICT (username) DO NOTHING;
    `,
      [adminUsername, "System Administrator", hashedPassword, roles["Admin"]]
    );

    const adminUserRes = await client.query(
      `SELECT id FROM "Users" WHERE username = $1;`,
      [adminUsername]
    );
    const adminUserId = adminUserRes.rows[0].id;
    console.log(
      `Seeded/Fetched Admin User: ${adminUsername} (ID: ${adminUserId})`
    );

    // --- 5. Seed Groups ---
    await client.query(`
      INSERT INTO "Groups" (name, description)
      VALUES
        ('Development Team', 'Responsible for software development goals and tasks.'),
        ('Marketing Team', 'Responsible for marketing and outreach goals and campaigns.')
      ON CONFLICT (name) DO NOTHING;
    `);
    const groupsResult = await client.query(
      `SELECT id, name FROM "Groups" WHERE name IN ('Development Team', 'Marketing Team');`
    );
    const groups = groupsResult.rows.reduce((acc, curr) => {
      acc[curr.name] = curr.id;
      return acc;
    }, {});
    console.log("Seeded/Fetched Groups:", groups);

    // --- 6. Seed Sample Users ---
    const defaultUserPasswordHash = await bcrypt.hash("password", 10);

    const usersToSeed = [
      {
        username: "manager1",
        name: "Alice Manager",
        role: "Manager",
        group: "Development Team",
      },
      {
        username: "dev1",
        name: "Bob Developer",
        role: "User",
        group: "Development Team",
      },
      {
        username: "marketer1",
        name: "Charlie Marketer",
        role: "User",
        group: "Marketing Team",
      },
    ];

    const seededUserIds = {};
    for (const user of usersToSeed) {
      await client.query(
        `
        INSERT INTO "Users" (username, name, password, "roleId")
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (username) DO NOTHING;
      `,
        [user.username, user.name, defaultUserPasswordHash, roles[user.role]]
      );

      const userRes = await client.query(
        `SELECT id FROM "Users" WHERE username = $1;`,
        [user.username]
      );
      seededUserIds[user.username] = userRes.rows[0].id;
      console.log(
        `Seeded/Fetched User: ${user.username} (ID: ${
          seededUserIds[user.username]
        })`
      );
    }

    // --- 7. Assign Sample Users to Groups ---
    for (const user of usersToSeed) {
      if (seededUserIds[user.username] && groups[user.group]) {
        await client.query(
          `
          INSERT INTO "UserGroups" ("userId", "groupId")
          VALUES ($1, $2)
          ON CONFLICT ("userId", "groupId") DO NOTHING;
        `,
          [seededUserIds[user.username], groups[user.group]]
        );
      }
    }
    console.log("Assigned Sample Users to Groups.");

    // --- 8. Seed Sample Goals (Associated with Groups) ---
    await client.query(`
      INSERT INTO "Goals" (title, description, "groupId", "startDate", "endDate", status, progress)
      VALUES
        ('Launch New Feature X', 'Develop and deploy the core feature set for product X.', ${groups["Development Team"]}, '2025-01-01', '2025-03-31', 'In Progress', 30),
        ('Increase Market Share by 10%', 'Execute marketing campaigns to expand customer base.', ${groups["Marketing Team"]}, '2025-02-01', '2025-06-30', 'Not Started', 0)
      ON CONFLICT (title) DO NOTHING;
    `);
    console.log("Seeded Sample Goals.");

    await client.query("COMMIT"); // Commit the transaction
    console.log("Database seeding completed successfully!");
  } catch (err) {
    await client.query("ROLLBACK"); // Rollback on error
    console.error("Error seeding database:", err);
    process.exit(1); // Exit with error code
  } finally {
    client.release(); // Release the client back to the pool
  }
}

seedDatabase();
