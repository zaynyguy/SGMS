const db = require('../src/db');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function seedDatabase() {
  console.log('Seeding database with simplified permissions and no email...');
  try {
    // --- Seed Roles ---
    await db.query(`
      INSERT INTO "Roles" (name, description) VALUES
      ('Admin', 'Has all permissions.'),
      ('Manager', 'Can manage goals, tasks, and activities.'),
      ('User', 'Can view and update their own items.');
    `);
    console.log('Roles seeded.');

    // --- Seed Simplified Permissions ---
    await db.query(`
      INSERT INTO "Permissions" (name, description) VALUES
      ('manage_users', 'Full control over users'),
      ('manage_roles', 'Full control over roles and permissions'),
      ('manage_goals', 'Full control over all goals'),
      ('manage_tasks', 'Full control over all tasks and activities'),
      ('manage_reports', 'Full control over reports'),
      ('view_dashboard', 'Can view the main dashboard');
    `);
    console.log('Permissions seeded.');

    // --- Seed Admin User ---
    const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
    const adminRoleResult = await db.query(`SELECT id from "Roles" WHERE name = 'Admin'`);
    const adminRoleId = adminRoleResult.rows[0].id;

    await db.query(
      `INSERT INTO "Users" (username, name, password, "roleId") VALUES ($1, $2, $3, $4)`,
      [process.env.ADMIN_USERNAME, 'Administrator', hashedPassword, adminRoleId]
    );
    console.log('Admin user seeded.');

    // --- Assign All Permissions to Admin ---
    const allPermissionsResult = await db.query(`SELECT id FROM "Permissions"`);
    for (const perm of allPermissionsResult.rows) {
        await db.query(
            `INSERT INTO "RolePermissions" ("roleId", "permissionId") VALUES ($1, $2)`,
            [adminRoleId, perm.id]
        );
    }
    console.log('Admin role permissions seeded.');

    console.log('Database seeding completed successfully!');

  } catch (error) {
    console.error('Error seeding database:', error);
  }
}

seedDatabase();
