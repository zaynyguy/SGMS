// src/controllers/dashboardController.js
const db = require("../db");
const { hasPermission, getUserGroupIds } = require("../utils/permHelper");


function buildScopeParams(groupScope) {
  if (groupScope === null) return { params: [], placeholders: null };
  if (!Array.isArray(groupScope)) groupScope = [groupScope];
  const params = groupScope;
  const placeholders = params.map((_, i) => `$${i + 1}`).join(",");
  return { params, placeholders };
}

exports.getSummary = async (req, res) => {
  try {
    const requestedGroupId = req.query.groupId
      ? Number(req.query.groupId)
      : null;
    const isManager = hasPermission(req.user, "manage_dashboard");
    const canView = hasPermission(req.user, "view_dashboard") || isManager;
    if (!canView)
      return res
        .status(403)
        .json({ message: "Forbidden: no dashboard permission." });

    let groupScope = null;
    if (isManager) {
      groupScope = requestedGroupId || null; // null => system-wide
    } else {
      const gids = await getUserGroupIds(req.user);
      if (!gids.length) return res.json({}); // empty for users with no groups
      groupScope = gids;
    }

    const { params, placeholders } = buildScopeParams(groupScope);
    // helper to return clause for subqueries
    const clauseFor = (alias) => {
      if (!placeholders) return "";
      return ` AND ${alias}."groupId" IN (${placeholders})`;
    };

    const q = `
      SELECT
        -- average goal progress
        (SELECT COALESCE(AVG(g.progress)::numeric,0)
           FROM "Goals" g
           WHERE 1=1 ${clauseFor("g")}
        )::numeric(5,2) AS overall_goal_progress,

        -- average task progress
        (SELECT COALESCE(AVG(t.progress)::numeric,0)
           FROM "Tasks" t
           JOIN "Goals" g2 ON t."goalId" = g2.id
           WHERE 1=1 ${clauseFor("g2")}
        )::numeric(5,2) AS overall_task_progress,

        -- activities weighted completion
        (SELECT
           CASE WHEN SUM(a.weight) IS NULL OR SUM(a.weight)=0 THEN 0
           ELSE ROUND( SUM( CASE WHEN a."isDone" THEN a.weight ELSE 0 END ) / SUM(a.weight) * 100, 2)
           END
         FROM "Activities" a
         JOIN "Tasks" t2 ON a."taskId" = t2.id
         JOIN "Goals" g3 ON t2."goalId" = g3.id
         WHERE 1=1 ${clauseFor("g3")}
        )::numeric(5,2) AS overall_activity_progress,

        -- pending reports
        (SELECT COUNT(*)
         FROM "Reports" r
         JOIN "Activities" a4 ON r."activityId" = a4.id
         JOIN "Tasks" t4 ON a4."taskId" = t4.id
         JOIN "Goals" g4 ON t4."goalId" = g4.id
         WHERE r.status = 'Pending' ${clauseFor("g4")}
        ) AS pending_reports,

        -- totals
        (SELECT COUNT(*) FROM "Goals" g5 WHERE 1=1 ${clauseFor(
          "g5"
        )}) AS goals_count,
        (SELECT COUNT(*) FROM "Tasks" t5 JOIN "Goals" gg ON t5."goalId"=gg.id WHERE 1=1 ${clauseFor(
          "gg"
        )}) AS tasks_count,
        (SELECT COUNT(*) FROM "Activities" a6 JOIN "Tasks" tt ON a6."taskId"=tt.id JOIN "Goals" g6 ON tt."goalId"=g6.id WHERE 1=1 ${clauseFor(
          "g6"
        )}) AS activities_count,

        -- unread notifications for this user (if user-specific)
        (SELECT COUNT(*) FROM "Notifications" n WHERE n."userId" = $${
          params.length + 1
        } AND n."isRead" = false) AS unread_notifications
    `;

    const finalParams = params.concat([req.user.id]);
    const { rows } = await db.query(q, finalParams);
    return res.json(rows[0] || {});
  } catch (err) {
    console.error("dashboard.getSummary error", err);
    res.status(500).json({ error: err.message });
  }
};

exports.getCharts = async (req, res) => {
  try {
    const type = req.query.type || "group";
    const requestedGroupId = req.query.groupId
      ? Number(req.query.groupId)
      : null;
    const dateFrom = req.query.dateFrom ? req.query.dateFrom : null;
    const dateTo = req.query.dateTo ? req.query.dateTo : null;
    const isManager = hasPermission(req.user, "manage_dashboard");
    const canView = hasPermission(req.user, "view_dashboard") || isManager;
    if (!canView) return res.status(403).json({ message: "Forbidden" });

    let groupScope = null;
    if (isManager) groupScope = requestedGroupId || null;
    else groupScope = await getUserGroupIds(req.user);

    if (type === "group") {
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
    }

    if (type === "task") {
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
    }

    if (type === "reports") {
      // distribution of report statuses
      const params = [];
      let statusWhere = "";
      if (groupScope !== null && Array.isArray(groupScope)) {
        statusWhere = ` AND g."groupId" = ANY($1::int[])`;
        params.push(groupScope);
      } else if (groupScope !== null) {
        statusWhere = ` AND g."groupId" = $1`;
        params.push(groupScope);
      }
      const q = `
        SELECT r.status, COUNT(*)::int as count
        FROM "Reports" r
        JOIN "Activities" a ON r."activityId" = a.id
        JOIN "Tasks" t ON a."taskId" = t.id
        JOIN "Goals" g ON t."goalId" = g.id
        WHERE 1=1 ${statusWhere}
        GROUP BY r.status`;
      const { rows } = params.length
        ? await db.query(q, params)
        : await db.query(q);

      const dist = { Pending: 0, Approved: 0, Rejected: 0 };
      rows.forEach((r) => {
        dist[r.status] = Number(r.count);
      });
      return res.json(dist);
    }

    if (type === "history") {

      const entityType = req.query.entityType || "Activity";
      const entityId = req.query.entityId ? Number(req.query.entityId) : null;
      const qParts = [
        `SELECT recorded_at::date as date, AVG(progress)::int as progress`,
      ];
      const qFrom = ` FROM "ProgressHistory" ph WHERE ph.entity_type = $1`;
      const qParams = [entityType];
      if (entityId) {
        qParts.push(qFrom + ` AND ph.entity_id = $2`);
        qParams.push(entityId);
      } else {
        qParts.push(qFrom);
      }
      if (dateFrom) {
        qParts[qParts.length - 1] += ` AND ph.recorded_at::date >= $${
          qParams.length + 1
        }`;
        qParams.push(dateFrom);
      }
      if (dateTo) {
        qParts[qParts.length - 1] += ` AND ph.recorded_at::date <= $${
          qParams.length + 1
        }`;
        qParams.push(dateTo);
      }
      const qFinal =
        qParts.join("") +
        ` GROUP BY recorded_at::date ORDER BY date ASC LIMIT 500`;
      const { rows } = await db.query(qFinal, qParams);
      return res.json(rows);
    }

    return res.status(400).json({ error: "invalid type" });
  } catch (err) {
    console.error("dashboard.getCharts error", err);
    res.status(500).json({ error: err.message });
  }
};

exports.getOverdueTasks = async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 5)));
    const requestedGroupId = req.query.groupId
      ? Number(req.query.groupId)
      : null;
    const isManager = hasPermission(req.user, "manage_dashboard");
    const canView = hasPermission(req.user, "view_dashboard") || isManager;
    if (!canView) return res.status(403).json({ message: "Forbidden" });

    let groupScope = null;
    if (isManager) groupScope = requestedGroupId || null;
    else groupScope = await getUserGroupIds(req.user);

    if (groupScope === null) {
      const q = `
        SELECT t.id as "taskId", t.title as "taskTitle", t."dueDate",
               (CURRENT_DATE - t."dueDate")::int as days_overdue,
               g.id as "goalId", g.title as "goalTitle",
               u.id as "assigneeId", u.name as "assigneeName",
               gr.id as "groupId", gr.name as "groupName"
        FROM "Tasks" t
        JOIN "Goals" g ON t."goalId" = g.id
        LEFT JOIN "Users" u ON u.id = t."assigneeId"
        LEFT JOIN "Groups" gr ON gr.id = g."groupId"
        WHERE t."dueDate" IS NOT NULL AND t."dueDate" < CURRENT_DATE
        ORDER BY days_overdue DESC LIMIT $1`;
      const { rows } = await db.query(q, [limit]);
      return res.json(rows);
    } else {
      const q = `
        SELECT t.id as "taskId", t.title as "taskTitle", t."dueDate",
               (CURRENT_DATE - t."dueDate")::int as days_overdue,
               g.id as "goalId", g.title as "goalTitle",
               u.id as "assigneeId", u.name as "assigneeName",
               gr.id as "groupId", gr.name as "groupName"
        FROM "Tasks" t
        JOIN "Goals" g ON t."goalId" = g.id
        LEFT JOIN "Users" u ON u.id = t."assigneeId"
        LEFT JOIN "Groups" gr ON gr.id = g."groupId"
        WHERE t."dueDate" IS NOT NULL AND t."dueDate" < CURRENT_DATE AND g."groupId" = ANY($1::int[])
        ORDER BY days_overdue DESC LIMIT $2`;
      const { rows } = await db.query(q, [groupScope, limit]);
      return res.json(rows);
    }
  } catch (err) {
    console.error("dashboard.getOverdueTasks error", err);
    res.status(500).json({ error: err.message });
  }
};

exports.getNotifications = async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 10)));
    const isManager = hasPermission(req.user, "manage_dashboard");
    const requestedUserId = req.query.userId ? Number(req.query.userId) : null;
    let targetUser = req.user.id;
    if (isManager && requestedUserId) targetUser = requestedUserId;

    const { rows } = await db.query(
      `SELECT id, "userId", type, message, meta, level, "isRead", "createdAt"
       FROM "Notifications"
       WHERE "userId" = $1
       ORDER BY "createdAt" DESC LIMIT $2`,
      [targetUser, limit]
    );
    return res.json(rows);
  } catch (err) {
    console.error("dashboard.getNotifications error", err);
    res.status(500).json({ error: err.message });
  }
};

exports.getAudit = async (req, res) => {
  try {
    const isManager = hasPermission(req.user, "manage_dashboard");
    if (!isManager) return res.status(403).json({ message: "Forbidden" });

    const limit = Math.min(200, Math.max(1, Number(req.query.limit || 25)));
    const { rows } = await db.query(
      `SELECT al.id, al."userId", u.name as userName, al.action, al.entity, al."entityId", al.details, al."createdAt"
       FROM "AuditLogs" al
       LEFT JOIN "Users" u ON u.id = al."userId"
       ORDER BY al."createdAt" DESC LIMIT $1`,
      [limit]
    );
    return res.json(rows);
  } catch (err) {
    console.error("dashboard.getAudit error", err);
    res.status(500).json({ error: err.message });
  }
};
