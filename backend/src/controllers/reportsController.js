const db = require('../db');
const fs = require('fs');

const updateProgress = async (client, activityId) => {
  const activityRes = await client.query('SELECT "taskId" FROM "Activities" WHERE id = $1', [activityId]);
  if (!activityRes.rows[0]) return;
  const { taskId } = activityRes.rows[0];

  const taskProgressRes = await client.query(
    `SELECT CAST(COUNT(CASE WHEN status = 'Done' THEN 1 END) AS FLOAT) / COUNT(*) * 100 AS progress
     FROM "Activities" WHERE "taskId" = $1`, [taskId]
  );
  const taskProgress = Math.round(taskProgressRes.rows[0].progress || 0);
  await client.query('UPDATE "Tasks" SET progress = $1 WHERE id = $2', [taskProgress, taskId]);

  const taskRes = await client.query('SELECT "goalId" FROM "Tasks" WHERE id = $1', [taskId]);
  if (!taskRes.rows[0]) return;
  const { goalId } = taskRes.rows[0];

  const goalProgressRes = await client.query(
    `SELECT CAST(COUNT(CASE WHEN progress = 100 THEN 1 END) AS FLOAT) / COUNT(*) * 100 AS progress
     FROM "Tasks" WHERE "goalId" = $1`, [goalId]
  );
  const goalProgress = Math.round(goalProgressRes.rows[0].progress || 0);
  await client.query('UPDATE "Goals" SET progress = $1 WHERE id = $2', [goalProgress, goalId]);
};

exports.submitReport = async (req, res) => {
  const { activityId } = req.params;
  const userId = req.user.id;
  const { narrative, metrics_data } = req.body;
  const files = req.files;

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const reportResult = await client.query(
      'INSERT INTO "Reports" ("activityId", "userId", narrative, metrics_data) VALUES ($1, $2, $3, $4) RETURNING id',
      [activityId, userId, narrative, metrics_data]
    );
    const reportId = reportResult.rows[0].id;

    if (files && files.length > 0) {
      for (const file of files) {
        await client.query(
          'INSERT INTO "Attachments" ("reportId", "fileName", "filePath", "fileType") VALUES ($1, $2, $3, $4)',
          [reportId, file.originalname, file.path, file.mimetype]
        );
      }
    }
    await client.query('COMMIT');
    res.status(201).json({ message: 'Report submitted successfully.' });
  } catch (error) {
    await client.query('ROLLBACK');
    if (files && files.length > 0) {
      files.forEach(file => fs.unlink(file.path, (err) => { if(err) console.error("Error cleaning up file:", err)}));
    }
    console.error("Error submitting report:", error);
    res.status(500).json({ message: 'Internal server error.' });
  } finally {
    client.release();
  }
};

exports.reviewReport = async (req, res) => {
  const { reportId } = req.params;
  const { status, adminComment } = req.body;

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const reportRes = await client.query('SELECT "activityId" FROM "Reports" WHERE id = $1', [reportId]);
    const { activityId } = reportRes.rows[0];

    if (status === 'Approved') {
      await client.query('UPDATE "Reports" SET status = $1, "adminComment" = $2 WHERE id = $3', [status, adminComment, reportId]);
      await client.query('UPDATE "Activities" SET status = $1 WHERE id = $2', ['Done', activityId]);
      await updateProgress(client, activityId);
    } else if (status === 'Rejected') {
      const settingsRes = await client.query(`SELECT value FROM "SystemSettings" WHERE key = 'resubmission_deadline_days'`);
      const deadlineDays = parseInt(settingsRes.rows[0].value, 10);
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + deadlineDays);

      await client.query(
        'UPDATE "Reports" SET status = $1, "adminComment" = $2, "resubmissionDeadline" = $3 WHERE id = $4',
        [status, adminComment, deadline, reportId]
      );
    }
    await client.query('COMMIT');
    res.status(200).json({ message: `Report has been ${status.toLowerCase()}.` });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error reviewing report:", error);
    res.status(500).json({ message: 'Internal server error.' });
  } finally {
    client.release();
  }
};