const db = require('../db');
const fs = require('fs');
const path = require('path')
const { generateReportHtml } = require('../utils/reportGenerator');

// Helper function to recursively update progress upwards
const updateProgress = async (client, activityId) => {
    // 1. Get Task ID from Activity
    const activityRes = await client.query('SELECT "taskId" FROM "Activities" WHERE id = $1', [activityId]);
    if (!activityRes.rows[0] || !activityRes.rows[0].taskId) return; // Stop if no parent task
    const { taskId } = activityRes.rows[0];

    // 2. Calculate Task Progress from its activities
    const taskProgressRes = await client.query(
        `SELECT COALESCE(AVG(CASE WHEN status = 'Done' THEN 100 ELSE 0 END), 0) AS progress FROM "Activities" WHERE "taskId" = $1`,
        [taskId]
    );
    const taskProgress = Math.round(taskProgressRes.rows[0].progress);
    await client.query('UPDATE "Tasks" SET progress = $1 WHERE id = $2', [taskProgress, taskId]);

    // 3. Get Goal ID from Task
    const taskRes = await client.query('SELECT "goalId" FROM "Tasks" WHERE id = $1', [taskId]);
    if (!taskRes.rows[0]) return;
    const { goalId } = taskRes.rows[0];

    // 4. Calculate Goal Progress from its tasks
    const goalProgressRes = await client.query(
        `SELECT COALESCE(AVG(progress), 0) AS progress FROM "Tasks" WHERE "goalId" = $1`,
        [goalId]
    );
    const goalProgress = Math.round(goalProgressRes.rows[0].progress);
    await client.query('UPDATE "Goals" SET progress = $1 WHERE id = $2', [goalProgress, goalId]);
};


exports.submitReport = async (req, res) => {
    const { activityId } = req.params;
    const userId = req.user.id;
    const { narrative, metrics_data, new_status } = req.body;
    const files = req.files;

    const client = await db.connect();
    try {
        await client.query('BEGIN');

        // Check reporting window setting
        const settings = await client.query(`SELECT value FROM "SystemSettings" WHERE key = 'reporting_active'`);
        if (settings.rows[0].value === 'true') {
            // Logic to check if we are within the reporting days can be added here
        }

        const reportResult = await client.query(
            'INSERT INTO "Reports" ("activityId", "userId", narrative, metrics_data, new_status) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [activityId, userId, narrative, metrics_data, new_status]
        );
        const reportId = reportResult.rows[0].id;

        if (files && files.length > 0) {
            const attachmentPromises = files.map(file =>
                client.query(
                    'INSERT INTO "Attachments" ("reportId", "fileName", "filePath", "fileType") VALUES ($1, $2, $3, $4)',
                    [reportId, file.originalname, file.path, file.mimetype]
                )
            );
            await Promise.all(attachmentPromises);
        }

        await client.query('COMMIT');
        res.status(201).json({ message: 'Report submitted successfully.' });
    } catch (error) {
        await client.query('ROLLBACK');
        if (files && files.length > 0) {
            files.forEach(file => fs.unlinkSync(file.path));
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
        const reportRes = await client.query('SELECT "activityId", new_status FROM "Reports" WHERE id = $1', [reportId]);
        if (reportRes.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({ message: "Report not found." });
        }
        const { activityId, new_status } = reportRes.rows[0];

        if (status === 'Approved') {
            await client.query('UPDATE "Reports" SET status = $1, "adminComment" = $2 WHERE id = $3', [status, adminComment, reportId]);
            await client.query('UPDATE "Activities" SET status = $1 WHERE id = $2', [new_status, activityId]);
            await updateProgress(client, activityId); // Trigger the automatic progress update
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

exports.generateMasterReport = async (req, res) => {
    try {
        // This is a complex query to fetch all data in a structured way
        const query = `
            SELECT 
                g.id as goal_id, g.title as goal_title,
                t.id as task_id, t.title as task_title,
                a.id as activity_id, a.title as activity_title, a.description as activity_description,
                r.narrative as report_narrative, att.id as attachment_id, att."fileName"
            FROM "Goals" g
            LEFT JOIN "Tasks" t ON t."goalId" = g.id
            LEFT JOIN "Activities" a ON a."taskId" = t.id
            LEFT JOIN "Reports" r ON r."activityId" = a.id AND r.status = 'Approved'
            LEFT JOIN "Attachments" att ON att."reportId" = r.id
            ORDER BY g.id, t.id, a.id;
        `;
        const { rows } = await db.query(query);

        // Pass the raw data to a helper function to generate the HTML
        const htmlContent = generateReportHtml(rows);

        // For now, we send the HTML directly. In a real app, we'd save it and send a link.
        res.header('Content-Type', 'text/html');
        res.send(htmlContent);
    } catch (error) {
        console.error("Error generating master report:", error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

// Fetch all reports, optionally filtered by status
exports.getAllReports = async (req, res) => {
    const { status } = req.query;
    try {
        let query = `
            SELECT r.*, u.username, a.title as "activityTitle", t.title as "taskTitle", g.title as "goalTitle"
            FROM "Reports" r
            JOIN "Users" u ON r."userId" = u.id
            JOIN "Activities" a ON r."activityId" = a.id
            JOIN "Tasks" t ON a."taskId" = t.id
            JOIN "Goals" g ON t."goalId" = g.id
        `;
        const queryParams = [];

        if (status) {
            query += ' WHERE r.status = $1';
            queryParams.push(status);
        }

        query += ' ORDER BY r."createdAt" DESC';

        const { rows } = await db.query(query, queryParams);
        res.status(200).json(rows);
    } catch (error) {
        console.error("Error fetching reports:", error);
        res.status(500).json({ message: "Internal server error." });
    }
};

// Download a specific attachment by its ID
exports.downloadAttachment = async (req, res) => {
    const { attachmentId } = req.params;
    try {
        const attachmentRes = await db.query('SELECT "filePath", "fileName" FROM "Attachments" WHERE id = $1', [attachmentId]);
        if (attachmentRes.rows.length === 0) {
            return res.status(404).json({ message: "Attachment not found." });
        }

        const { filePath, fileName } = attachmentRes.rows[0];
        const fullPath = path.resolve(filePath);

        // Check if the file exists before attempting to send it
        if (fs.existsSync(fullPath)) {
            res.download(fullPath, fileName, (err) => {
                if (err) {
                    console.error("Error downloading file:", err);
                    res.status(500).json({ message: "Could not download the file." });
                }
            });
        } else {
            res.status(404).json({ message: "File not found on server." });
        }
    } catch (error) {
        console.error("Error fetching attachment:", error);
        res.status(500).json({ message: "Internal server error." });
    }
};
