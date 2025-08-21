export default function Attachment() {
    return(
        <div>
            <h1>this is Attachment</h1>
            <p>bro, i pasted attachmentsController.js on the GPT then he gave me a Refined Version so i want asking u do i stick to it or you will change it</p>
            <p>the changed version </p>
        {/* 
        GPT said: I notice a few things you can tighten up for security, maintainability, and correctness:
        
            const db = require("../db");
            const fs = require("fs");
            const path = require("path");

            const UPLOADS_DIR = path.join(__dirname, "../uploads");

            // -------------------- GET ALL ATTACHMENTS (ADMIN ONLY) --------------------
            exports.getAllAttachments = async (req, res) => {
            try {
                const { rows } = await db.query(`
                SELECT a.id, a."fileName", a."filePath", a."fileType",
                        r.id as "reportId", u.username as "uploadedBy",
                        g.name as "groupName"
                FROM "Attachments" a
                JOIN "Reports" r ON a."reportId" = r.id
                JOIN "Users" u ON r."userId" = u.id
                LEFT JOIN "Activities" act ON r."activityId" = act.id
                LEFT JOIN "Groups" g ON act."groupId" = g.id
                `);
                res.status(200).json(rows);
            } catch (err) {
                console.error("Error in getAllAttachments:", err);
                res.status(500).json({ message: "Internal server error." });
            }
            };

            // -------------------- GET ATTACHMENTS FOR A GROUP --------------------
            exports.getGroupAttachments = async (req, res) => {
            const { groupId } = req.params;
            try {
                // TODO: Check group membership with req.user.id before returning results

                const { rows } = await db.query(
                `
                SELECT a.id, a."fileName", a."filePath", a."fileType",
                        r.id as "reportId", u.username as "uploadedBy"
                FROM "Attachments" a
                JOIN "Reports" r ON a."reportId" = r.id
                JOIN "Users" u ON r."userId" = u.id
                JOIN "Activities" act ON r."activityId" = act.id
                WHERE act."groupId" = $1
                `,
                [groupId]
                );
                res.status(200).json(rows);
            } catch (err) {
                console.error("Error in getGroupAttachments:", err);
                res.status(500).json({ message: "Internal server error." });
            }
            };

            // ---------------- GET ATTACHMENTS FOR A SINGLE REPORT ----------------
            exports.getReportAttachments = async (req, res) => {
            const { reportId } = req.params;
            try {
                const { rows } = await db.query(
                'SELECT id, "fileName", "filePath", "fileType" FROM "Attachments" WHERE "reportId" = $1',
                [reportId]
                );
                res.status(200).json(rows);
            } catch (err) {
                console.error("Error in getReportAttachments:", err);
                res.status(500).json({ message: "Internal server error." });
            }
            };

            // ----------------- SECURE DOWNLOAD -----------------
            exports.downloadAttachment = async (req, res) => {
            try {
                const { id } = req.params;
                const result = await db.query(
                `SELECT "filePath", "fileName" FROM "Attachments" WHERE id = $1`,
                [id]
                );
                if (result.rows.length === 0) {
                return res.status(404).json({ message: "Attachment not found" });
                }

                const { filePath, fileName } = result.rows[0];
                const absPath = path.join(UPLOADS_DIR, filePath);

                // Prevent path traversal
                if (!absPath.startsWith(UPLOADS_DIR)) {
                return res.status(403).json({ message: "Invalid file path" });
                }

                if (!fs.existsSync(absPath)) {
                return res.status(404).json({ message: "File missing on server" });
                }

                res.download(absPath, fileName);
            } catch (err) {
                console.error("Error in downloadAttachment:", err);
                res.status(500).json({ message: "Internal server error." });
            }
            }; */}

        </div>
    )
}