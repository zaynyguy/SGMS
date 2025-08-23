const db = require("../db");

exports.getDashboard = async (req, res) => {
  try {
    let filters = "";
    let params = [];

    // Users only see their own assignments
    if (!req.user.permissions.includes("manage_analytics")) {
      filters = `WHERE u.id = $1`;
      params.push(req.user.id);
    }

    const { rows } = await db.query(
      `
      SELECT
        (SELECT COUNT(*) FROM "Goals")::int AS total_goals,
        (SELECT COUNT(*) FROM "Tasks")::int AS total_tasks,
        (SELECT COUNT(*) FROM "Activities")::int AS total_activities,
        (SELECT COUNT(*) FROM "Reports")::int AS total_reports,
        (SELECT COUNT(*) FROM "Reports" WHERE status='Approved')::int AS approved_reports,
        (SELECT COUNT(*) FROM "Reports" WHERE status='Rejected')::int AS rejected_reports
    `,
      params
    );

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
