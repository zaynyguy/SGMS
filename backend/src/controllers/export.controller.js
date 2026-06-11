const db = require("../db");
const { buildGoalsWorkbook, buildTasksWorkbook, buildActivitiesWorkbook, buildAnnualPlanWorkbook, buildReportWorkbook, buildCsvFromRows } = require("../helpers/exportGenerator");

function acceptFormat(req) {
  const format = String(req.query.format || "xlsx").toLowerCase();
  return format === "csv" ? "csv" : "xlsx";
}

async function exportGoals(req, res) {
  try {
    const { rows } = await db.query(`SELECT id, title, description, "groupId", status, progress, weight, "startDate", "endDate", "createdAt", "updatedAt" FROM "Goals" ORDER BY id`);
    const format = acceptFormat(req);
    if (format === "csv") {
      const csv = buildCsvFromRows(rows, ["id", "title", "description", "groupId", "status", "progress", "weight", "startDate", "endDate", "createdAt", "updatedAt"]);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="goals.csv"`);
      return res.send(csv);
    }

    const workbook = buildGoalsWorkbook(rows);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="goals.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("exportGoals error:", err);
    res.status(500).json({ error: err.message || "Failed to export goals." });
  }
}

async function exportTasks(req, res) {
  try {
    const { rows } = await db.query(`SELECT id, "goalId", title, description, status, "assigneeId", "dueDate", progress, weight, "createdAt", "updatedAt" FROM "Tasks" ORDER BY id`);
    const format = acceptFormat(req);
    if (format === "csv") {
      const csv = buildCsvFromRows(rows, ["id", "goalId", "title", "description", "status", "assigneeId", "dueDate", "progress", "weight", "createdAt", "updatedAt"]);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="tasks.csv"`);
      return res.send(csv);
    }
    const workbook = buildTasksWorkbook(rows);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="tasks.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("exportTasks error:", err);
    res.status(500).json({ error: err.message || "Failed to export tasks." });
  }
}

async function exportActivities(req, res) {
  try {
    const { rows } = await db.query(`SELECT id, "taskId", title, description, status, "dueDate", "previousMetric", "targetMetric", "currentMetric", "quarterlyGoals", progress, weight, "isDone", "createdAt", "updatedAt" FROM "Activities" ORDER BY id`);
    const format = acceptFormat(req);
    if (format === "csv") {
      const csv = buildCsvFromRows(rows, ["id", "taskId", "title", "description", "status", "dueDate", "previousMetric", "targetMetric", "currentMetric", "quarterlyGoals", "progress", "weight", "isDone", "createdAt", "updatedAt"]);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="activities.csv"`);
      return res.send(csv);
    }
    const workbook = buildActivitiesWorkbook(rows);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="activities.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("exportActivities error:", err);
    res.status(500).json({ error: err.message || "Failed to export activities." });
  }
}

async function exportAnnualPlan(req, res) {
  try {
    const goals = (await db.query(`SELECT id, title, description, "groupId", status, progress, weight, "startDate", "endDate" FROM "Goals" ORDER BY id`)).rows;
    const tasks = (await db.query(`SELECT id, "goalId", title, description, status, "assigneeId", "dueDate", progress, weight FROM "Tasks" ORDER BY id`)).rows;
    const activities = (await db.query(`SELECT id, "taskId", title, description, status, "dueDate", "previousMetric", "targetMetric", "currentMetric", "quarterlyGoals", progress, weight, "isDone" FROM "Activities" ORDER BY id`)).rows;
    const format = acceptFormat(req);
    if (format === "csv") {
      const csv = buildCsvFromRows(goals, ["id", "title", "description", "groupId", "status", "progress", "weight", "startDate", "endDate"]);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="annual-plan.csv"`);
      return res.send(csv);
    }
    const workbook = buildAnnualPlanWorkbook(goals, tasks, activities);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="annual-plan.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("exportAnnualPlan error:", err);
    res.status(500).json({ error: err.message || "Failed to export annual plan." });
  }
}

async function exportReports(req, res) {
  try {
    const { rows } = await db.query(`SELECT r.id, r."activityId", r."userId", r.narrative, r."metrics_data", r."new_status", r."createdAt", r."updatedAt" FROM "Reports" r ORDER BY r.id`);
    const format = acceptFormat(req);
    if (format === "csv") {
      const csv = buildCsvFromRows(rows, ["id", "activityId", "userId", "narrative", "metrics_data", "new_status", "createdAt", "updatedAt"]);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="reports.csv"`);
      return res.send(csv);
    }
    const workbook = buildReportWorkbook(rows);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="reports.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("exportReports error:", err);
    res.status(500).json({ error: err.message || "Failed to export reports." });
  }
}

module.exports = {
  exportGoals,
  exportTasks,
  exportActivities,
  exportAnnualPlan,
  exportReports,
};
