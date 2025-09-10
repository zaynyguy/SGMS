// src/controllers/dashboardController.js

const db = require('../db');
const { hasPermission, getUserGroupIds } = require('../utils/permHelper');

exports.getSummary = async (req, res) => {
  try {
    const requestedGroupId = req.query.groupId ? Number(req.query.groupId) : null;
    const isManager = hasPermission(req.user, 'manage_dashboard');
    const canView = hasPermission(req.user, 'view_dashboard') || isManager;

    if (!canView) return res.status(403).json({ message: 'Forbidden: no dashboard permission.' });

    // Determine scope
    let groupScope = null;
    if (isManager) {
      groupScope = requestedGroupId || null; // null => system-wide
    } else {
      const gids = await getUserGroupIds(req.user);
      if (!gids.length) return res.status(403).json({ message: 'Forbidden: user not in any group.' });
      groupScope = gids; // array of ints
    }

    // Build params/placeholders (shared across subqueries)
    let params = [];
    let placeholders = null;
    if (groupScope !== null) {
      if (Array.isArray(groupScope)) {
        params = groupScope;
      } else {
        params = [groupScope];
      }
      // placeholders: $1,$2,... (we'll reuse same positions in every subquery)
      placeholders = params.map((_, i) => `$${i + 1}`).join(',');
    }

    // helper to return clause for a given alias (alias can be like g2, g3, gg, etc.)
    const clauseFor = (alias) => {
      if (!placeholders) return '';
      // if alias is falsy, reference column without alias (e.g. "Goals" gX use alias anyway)
      return ` AND ${alias}."groupId" IN (${placeholders})`;
    };

    const q = `
      SELECT
        -- goals average (alias g)
        (SELECT COALESCE(AVG(g.progress)::numeric,0) 
          FROM "Goals" g
          WHERE 1=1 ${clauseFor('g')}
        )::numeric(5,2) AS overall_goal_progress,

        -- tasks average (alias g2)
        (SELECT COALESCE(AVG(t.progress)::numeric,0)
          FROM "Tasks" t
          JOIN "Goals" g2 ON t."goalId" = g2.id
          WHERE 1=1 ${clauseFor('g2')}
        )::numeric(5,2) AS overall_task_progress,

        -- activities weighted completion (alias g3)
        (SELECT
           CASE WHEN SUM(a.weight) IS NULL OR SUM(a.weight)=0 THEN 0
           ELSE ROUND( SUM( CASE WHEN a."isDone" THEN a.weight ELSE 0 END ) / SUM(a.weight) * 100, 2)
           END
         FROM "Activities" a
         JOIN "Tasks" t2 ON a."taskId" = t2.id
         JOIN "Goals" g3 ON t2."goalId" = g3.id
         WHERE 1=1 ${clauseFor('g3')}
        )::numeric(5,2) AS overall_activity_progress,

        -- pending reports count (alias g4)
        (SELECT COUNT(*) 
         FROM "Reports" r 
         JOIN "Activities" a2 ON r."activityId" = a2.id 
         JOIN "Tasks" t3 ON a2."taskId" = t3.id 
         JOIN "Goals" g4 ON t3."goalId" = g4.id 
         WHERE r.status='Pending' ${clauseFor('g4')}
        ) AS pending_reports,

        -- goals count (alias g5)
        (SELECT COUNT(*) FROM "Goals" g5 WHERE 1=1 ${clauseFor('g5')}) AS goals_count,

        -- tasks count (alias gg)
        (SELECT COUNT(*) 
         FROM "Tasks" t 
         JOIN "Goals" gg ON t."goalId" = gg.id 
         WHERE 1=1 ${clauseFor('gg')}
        ) AS tasks_count,

        -- activities count (alias g6)
        (SELECT COUNT(*) 
         FROM "Activities" a 
         JOIN "Tasks" tt ON a."taskId" = tt.id 
         JOIN "Goals" g6 ON tt."goalId" = g6.id 
         WHERE 1=1 ${clauseFor('g6')}
        ) AS activities_count
    `;

    const { rows } = await db.query(q, params);
    return res.json(rows[0] || {});
  } catch (err) {
    console.error('dashboard.getSummary error', err);
    res.status(500).json({ error: err.message });
  }
};



exports.getCharts = async (req, res) => {
  try {
    const type = req.query.type || 'group';
    const requestedGroupId = req.query.groupId ? Number(req.query.groupId) : null;
    const isManager = hasPermission(req.user, 'manage_dashboard');
    const canView = hasPermission(req.user, 'view_dashboard') || isManager;
    if (!canView) return res.status(403).json({ message: 'Forbidden' });

    let groupScope = null;
    if (isManager) groupScope = requestedGroupId || null;
    else groupScope = await getUserGroupIds(req.user); // array

    if (type === 'group') {
      // If groupScope is array -> restrict to those groups; if null -> all groups
      if (groupScope === null) {
        const q = `
          SELECT gr.id as "groupId", gr.name,
            COALESCE(ROUND(AVG(g.progress)::numeric,2),0) as progress
          FROM "Groups" gr
          LEFT JOIN "Goals" g ON g."groupId" = gr.id
          GROUP BY gr.id ORDER BY gr.name`;
        const { rows } = await db.query(q);
        return res.json(rows);
      } else {
        // groupScope is an array
        const q = `
          SELECT gr.id as "groupId", gr.name,
            COALESCE(ROUND(AVG(g.progress)::numeric,2),0) as progress
          FROM "Groups" gr
          LEFT JOIN "Goals" g ON g."groupId" = gr.id
          WHERE gr.id = ANY($1::int[])
          GROUP BY gr.id ORDER BY gr.name`;
        const { rows } = await db.query(q, [groupScope]);
        return res.json(rows);
      }
    } else if (type === 'task') {
      // tasks for groups in scope
      if (groupScope === null) {
        const q = `
          SELECT t.id as "taskId", t.title, COALESCE(t.progress,0)::numeric(5,2) as progress
          FROM "Tasks" t
          JOIN "Goals" g ON t."goalId" = g.id
          ORDER BY t."createdAt" DESC LIMIT 500`;
        const { rows } = await db.query(q);
        return res.json(rows);
      } else {
        const q = `
          SELECT t.id as "taskId", t.title, COALESCE(t.progress,0)::numeric(5,2) as progress
          FROM "Tasks" t
          JOIN "Goals" g ON t."goalId" = g.id
          WHERE g."groupId" = ANY($1::int[])
          ORDER BY t."createdAt" DESC LIMIT 500`;
        const { rows } = await db.query(q, [groupScope]);
        return res.json(rows);
      }
    } else {
      return res.status(400).json({ error: 'invalid type' });
    }
  } catch (err) {
    console.error('dashboard.getCharts error', err);
    res.status(500).json({ error: err.message });
  }
};


exports.getOverdueTasks = async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 5)));
    const requestedGroupId = req.query.groupId ? Number(req.query.groupId) : null;
    const isManager = hasPermission(req.user, 'manage_dashboard');
    const canView = hasPermission(req.user, 'view_dashboard') || isManager;
    if (!canView) return res.status(403).json({ message: 'Forbidden' });

    let groupScope = null;
    if (isManager) groupScope = requestedGroupId || null;
    else groupScope = await getUserGroupIds(req.user);

    if (groupScope === null) {
      const q = `
        SELECT t.id as "taskId", t.title, t."dueDate", (CURRENT_DATE - t."dueDate")::int as days_overdue, g.id as "goalId", g.title as "goalTitle"
        FROM "Tasks" t JOIN "Goals" g ON t."goalId" = g.id
        WHERE t."dueDate" IS NOT NULL AND t."dueDate" < CURRENT_DATE
        ORDER BY days_overdue DESC LIMIT $1`;
      const { rows } = await db.query(q, [limit]);
      return res.json(rows);
    } else {
      const q = `
        SELECT t.id as "taskId", t.title, t."dueDate", (CURRENT_DATE - t."dueDate")::int as days_overdue, g.id as "goalId", g.title as "goalTitle"
        FROM "Tasks" t JOIN "Goals" g ON t."goalId" = g.id
        WHERE t."dueDate" IS NOT NULL AND t."dueDate" < CURRENT_DATE AND g."groupId" = ANY($1::int[])
        ORDER BY days_overdue DESC LIMIT $2`;
      const { rows } = await db.query(q, [groupScope, limit]);
      return res.json(rows);
    }
  } catch (err) {
    console.error('dashboard.getOverdueTasks error', err);
    res.status(500).json({ error: err.message });
  }
};
