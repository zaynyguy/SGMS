const db = require("../db");

// -------------------- GET ACTIVITIES BY TASK --------------------
exports.getActivitiesByTask = async (req, res) => {
  const { taskId } = req.params;
  try {
    const query = `
      SELECT a.*, g.name AS groupName
      FROM "Activities" a
      LEFT JOIN "Groups" g ON a."groupId" = g.id
      WHERE a."taskId" = $1
      ORDER BY a."createdAt" DESC;
    `;
    const { rows } = await db.query(query, [taskId]);
    res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching activities:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

// -------------------- CREATE ACTIVITY --------------------
exports.createActivity = async (req, res) => {
  const { taskId } = req.params;

  let { title, description, parentId, groupId, metrics, dueDate } = req.body;

  if (!title || !taskId) {
    return res.status(400).json({ message: "Title and taskId are required." });
  }

  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");

    // If groupId not provided, inherit from parent task
    if (!groupId) {
      const taskRes = await client.query(
        'SELECT "assigneeId" FROM "Tasks" WHERE id=$1',
        [taskId]
      );
      groupId = taskRes.rows[0]?.assigneeId || null;
    }

    const result = await client.query(
      `INSERT INTO "Activities" ("taskId", title, description, "groupId", metrics, "dueDate")
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *;`,
      [
        taskId,
        title.trim(),
        description?.trim() || null,
        groupId,
        metrics || {},
        dueDate || null,
      ]
    );

    await client.query("COMMIT");
    res.status(201).json({
      message: "Activity created successfully.",
      activity: result.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error creating activity:", error);
    res.status(500).json({ message: "Internal server error." });
  } finally {
    client.release();
  }
};

// -------------------- UPDATE ACTIVITY --------------------
exports.updateActivity = async (req, res) => {
  const { activityId } = req.params;
  const { title, description, parentId, groupId, metrics, status, dueDate } =
    req.body;

  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");

    const check = await client.query(
      'SELECT id FROM "Activities" WHERE id = $1',
      [activityId]
    );
    if (check.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Activity not found." });
    }

    const query = `
      UPDATE "Activities"
      SET title=$1, description=$2, "groupId"=$3, metrics=$4, status=$5, "dueDate"=$6, "updatedAt"=NOW()
      WHERE id=$7
      RETURNING *;
    `;
    const { rows } = await client.query(query, [
      title?.trim() || null,
      description?.trim() || null,
      groupId || null,
      metrics || {},
      status || null,
      dueDate || null,
      activityId,
    ]);

    await client.query("COMMIT");
    res
      .status(200)
      .json({ message: "Activity updated successfully.", activity: rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error updating activity:", error);
    res.status(500).json({ message: "Internal server error." });
  } finally {
    client.release();
  }
};

// -------------------- DELETE ACTIVITY --------------------
exports.deleteActivity = async (req, res) => {
  const { activityId } = req.params;
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");

    const check = await client.query(
      'SELECT id FROM "Activities" WHERE id = $1',
      [activityId]
    );
    if (check.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Activity not found." });
    }

    await client.query('DELETE FROM "Activities" WHERE id = $1', [activityId]);
    await client.query("COMMIT");

    res.status(200).json({ message: "Activity deleted successfully." });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error deleting activity:", error);
    res.status(500).json({ message: "Internal server error." });
  } finally {
    client.release();
  }
};
