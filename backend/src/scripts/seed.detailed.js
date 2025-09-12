// scr/scripts/seed.detailed.js

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../src/db'); // adjust path if needed
const bcrypt = require('bcrypt');

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

async function findSchema() {
  const candidates = [
    path.join(__dirname, '..', 'db', 'schema.sql'),
    path.join(__dirname, '..', 'schema.sql'),
    path.join(__dirname, 'schema.sql'),
    path.join(__dirname, '..', 'db', 'schema.sql')
  ];
  for (const p of candidates) if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8');
  throw new Error('schema.sql not found.');
}

async function run() {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const schemaSql = await findSchema();
    console.log('Applying schema (DROP/CREATE) ...');
    await client.query(schemaSql);

    // Roles
    const roleNames = ['Admin', 'Manager', 'User'];
    const roleIds = {};
    for (const r of roleNames) {
      const { rows } = await client.query(`INSERT INTO "Roles"(name, description) VALUES ($1,$2) RETURNING id`, [r, `${r} role`]);
      roleIds[r] = rows[0].id;
    }

    // Permissions (comprehensive)
    const perms = [
      "manage_gta","view_gta",
      "submit_reports","view_reports","manage_reports","manage_settings",
      "view_audit_logs","manage_notifications","manage_dashboard",
      "view_dashboard","manage_attachments","manage_access"
    ];
    const permIds = {};
    for (const p of perms) {
      const { rows } = await client.query(`INSERT INTO "Permissions"(name, description) VALUES ($1,$2) RETURNING id`, [p, `${p} permission`]);
      permIds[p] = rows[0].id;
    }

    async function grant(roleName, arr) {
      const rId = roleIds[roleName]; if (!rId) return;
      for (const name of arr) {
        const pid = permIds[name]; if (!pid) continue;
        await client.query(`INSERT INTO "RolePermissions"("roleId","permissionId") VALUES ($1,$2) ON CONFLICT DO NOTHING`, [rId, pid]);
      }
    }
    await grant('Admin', perms);
    await grant('Manager', [
      "manage_gta","view_gta",
      "manage_reports","view_reports","view_dashboard"
    ]);
    await grant('User', ["view_reports","view_gta","view_dashboard"]);

    // Admin user
    const adminUser = process.env.ADMIN_USERNAME || 'admin';
    const adminPass = process.env.ADMIN_PASSWORD || 'admin123';
    const adminHash = await bcrypt.hash(adminPass, 10);
    const { rows: arows } = await client.query(
      `INSERT INTO "Users"(username, name, password, "roleId", "profilePicture") VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [adminUser, 'System Admin', adminHash, roleIds['Admin'], '/uploads/admin.png']
    );
    const adminId = arows[0].id;

    // Create 3 groups
    const groupDefs = [
      { name: 'Development', desc: 'Dev team' },
      { name: 'QA', desc: 'Quality Assurance' },
      { name: 'Operations', desc: 'Ops & Infra' }
    ];
    const groupIds = [];
    for (const g of groupDefs) {
      const { rows } = await client.query(`INSERT INTO "Groups"(name, description) VALUES ($1,$2) RETURNING id`, [g.name, g.desc]);
      groupIds.push(rows[0].id);
    }

    // Create users per group (3 users per group) + one floating manager user
    const createdUsers = [];
    for (let i=0;i<groupIds.length;i++) {
      for (let j=1;j<=3;j++) {
        const username = `${groupDefs[i].name.toLowerCase()}_user${j}`;
        const name = `${groupDefs[i].name} User ${j}`;
        const pass = `pass${i+1}${j}`;
        const hash = await bcrypt.hash(pass, 8);
        const { rows } = await client.query(
          `INSERT INTO "Users"(username, name, password, "roleId") VALUES ($1,$2,$3,$4) RETURNING id`,
          [username, name, hash, roleIds['User']]
        );
        const uid = rows[0].id;
        createdUsers.push({ id: uid, username, password: pass, groupId: groupIds[i] });
        await client.query(`INSERT INTO "UserGroups"("userId","groupId") VALUES ($1,$2) ON CONFLICT DO NOTHING`, [uid, groupIds[i]]);
      }
    }

    // Add one manager user assigned to Development
    const mgrHash = await bcrypt.hash('manager123', 8);
    const { rows: mrows } = await client.query(
      `INSERT INTO "Users"(username, name, password, "roleId") VALUES ($1,$2,$3,$4) RETURNING id`,
      ['dev_manager', 'Dev Manager', mgrHash, roleIds['Manager']]
    );
    const managerId = mrows[0].id;
    await client.query(`INSERT INTO "UserGroups"("userId","groupId") VALUES ($1,$2)`, [managerId, groupIds[0]]);

    // Create goals/tasks/activities
    const goalIds = [];
    const taskIds = [];
    const activityIds = [];

    for (let gidx=0; gidx<groupIds.length; gidx++) {
      const gid = groupIds[gidx];
      // for each group create 3 goals
      for (let gi=1; gi<=3; gi++) {
        const goalTitle = `${groupDefs[gidx].name} Goal ${gi}`;
        const goalDesc = `Goal ${gi} for ${groupDefs[gidx].name}`;
        const goalWeight = 100; // default
        const p = randInt(0,50);
        const { rows: gr } = await client.query(
          `INSERT INTO "Goals"(title, description, "groupId", "startDate", "endDate", status, progress, weight)
           VALUES ($1,$2,$3,CURRENT_DATE - INTERVAL '5 days', CURRENT_DATE + INTERVAL '25 days','In Progress',$4,$5) RETURNING id`,
          [goalTitle, goalDesc, gid, p, goalWeight]
        );
        const goalId = gr[0].id;
        goalIds.push(goalId);

        // create 3 tasks per goal
        for (let ti=1; ti<=3; ti++) {
          const tTitle = `${goalTitle} Task ${ti}`;
          const tDesc = `Task ${ti} under ${goalTitle}`;
          const assignee = createdUsers[(gidx*3 + ((ti-1)%3))].id; // pick user from group
          const tWeight = randInt(10, 40);
          const tProgress = randInt(0, 80);
          const { rows: tr } = await client.query(
            `INSERT INTO "Tasks"(title, description, "goalId", status, "assigneeId", "dueDate", progress, weight)
             VALUES ($1,$2,$3,'In Progress',$4,CURRENT_DATE + INTERVAL '14 days',$5,$6) RETURNING id`,
            [tTitle, tDesc, goalId, assignee, tProgress, tWeight]
          );
          const taskId = tr[0].id;
          taskIds.push(taskId);

          // create 2 activities per task
          for (let ai=1; ai<=2; ai++) {
            const aTitle = `${tTitle} Activity ${ai}`;
            const aDesc = `Activity ${ai} for ${tTitle}`;
            const aWeight = Math.max(1, Math.round(tWeight / 2));
            const targetMetric = { target: randInt(100, 1000) };
            const currentMetric = { current: randInt(0, targetMetric.target) };
            const isDone = Math.random() > 0.6 ? true : false;
            const status = isDone ? 'Done' : (Math.random() > 0.4 ? 'In Progress' : 'To Do');
            const { rows: ar } = await client.query(
              `INSERT INTO "Activities"(title, description, "taskId", status, weight, "targetMetric", "currentMetric", "isDone")
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
              [aTitle, aDesc, taskId, status, aWeight, JSON.stringify(targetMetric), JSON.stringify(currentMetric), isDone]
            );
            const activityId = ar[0].id;
            activityIds.push(activityId);

            // create 0-2 reports per activity, some approved, some pending, some rejected
            const numReports = Math.random() > 0.6 ? 1 : randInt(0,2);
            for (let ri=0; ri<numReports; ri++) {
              const reporter = Math.random() > 0.5 ? adminId : createdUsers[(gidx*3 + (ri%3))].id;
              const metricVal = { lines: randInt(0, targetMetric.target) };
              const rStatusRoll = Math.random();
              let rStatus = 'Pending';
              if (rStatusRoll > 0.85) rStatus = 'Rejected';
              else if (rStatusRoll > 0.6) rStatus = 'Approved';
              const narrative = `Report ${ri+1} for ${aTitle}`;
              const { rows: rr } = await client.query(
                `INSERT INTO "Reports"("activityId","userId", narrative, metrics_data, status, "createdAt")
                 VALUES ($1,$2,$3,$4,$5, now() - (interval '1 day' * $6)) RETURNING id`,
                [activityId, reporter, narrative, JSON.stringify(metricVal), rStatus, randInt(0,10)]
              );
            }
          } // end activities
        } // end tasks
      } // end goals
    } // end groups loop

    // Basic system settings
    const settings = [
      { key: 'max_attachment_size_mb', value: 10, description: 'Max attachment upload size (MB)' },
      { key: 'allowed_attachment_types', value: ['application/pdf','image/png','image/jpeg','text/plain'], description: 'Allowed MIME types' },
      { key: 'reporting_active', value: true, description: 'Enable report submissions' },
      { key: 'resubmission_deadline_days', value: 7, description: 'Days to resubmit rejected reports' },
      { key: 'audit_retention_days', value: 365, description: 'Days to retain audit logs' }
    ];
    for (const s of settings) {
      await client.query(`INSERT INTO "SystemSettings"(key, value, description) VALUES ($1,$2::jsonb,$3)`, [s.key, JSON.stringify(s.value), s.description]);
    }

    await client.query('COMMIT');
    console.log('Detailed seed complete.');
    console.log(`Created groups: ${groupIds.length}, users: ${createdUsers.length + 2} (incl manager & admin)`);
    console.log(`Goals: approx ${groupIds.length*3}, Tasks: approx ${groupIds.length*3*3}, Activities: approx ${groupIds.length*3*3*2}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Detailed seed failed:', err);
    process.exitCode = 1;
  } finally {
    client.release();
  }
}

run();
