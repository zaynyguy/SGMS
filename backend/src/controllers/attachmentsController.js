const db = require("../db");

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
    res.status(500).json({ message: "Internal server error." });
  }
};

// -------------------- GET ATTACHMENTS FOR A GROUP --------------------
exports.getGroupAttachments = async (req, res) => {
  const { groupId } = req.params;
  try {
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
    res.status(500).json({ message: "Internal server error." });
  }
};

// ----------------- SUCURE DOWNLOAD -----------------
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
    const absPath = path.resolve(filePath);

    
    if (!fs.existsSync(absPath)) {
      return res.status(404).json({ message: "File missing on server" });
    }

    res.download(absPath, fileName); 
  } catch (err) {
    res.status(500).json({ message: "Internal server error." });
  }
};