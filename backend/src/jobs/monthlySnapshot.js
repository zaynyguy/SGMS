// src/jobs/monthlySnapshot.js
require("dotenv").config();
const cron = require("node-cron");
const db = require("../db");
const ADVISORY_LOCK_KEY = process.env.ADVISORY_LOCK_KEY;

function monthStartFromDate(d = new Date()) {
  const dt = new Date(d);
  const year = dt.getUTCFullYear();
  const month = dt.getUTCMonth();
  return new Date(Date.UTC(year, month, 1));
}
function formatSnapshotMonth(dt) {
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

async function snapshotMonthForAllActivities(snapshotMonthInput) {
  const pool = db;
  const client = await pool.connect();
  try {
    const snapshotMonthDate = snapshotMonthInput
      ? new Date(snapshotMonthInput)
      : monthStartFromDate(new Date());
    const snapshotMonthDateStart = monthStartFromDate(snapshotMonthDate);
    const snapshotMonthStr = snapshotMonthDateStart.toISOString().slice(0, 10); // 'YYYY-MM-DD'

    const lockRes = await client.query(
      "SELECT pg_try_advisory_lock($1) AS locked",
      [ADVISORY_LOCK_KEY]
    );
    if (!lockRes.rows?.[0]?.locked) {
      console.warn(
        "monthlySnapshot: could not acquire advisory lock - another process may be running."
      );
      return { ok: false, reason: "locked" };
    }

    await client.query("BEGIN");

    const { rows: activities } = await client.query(`
      SELECT a.id,
             a."taskId",
            a."progress",
             t."goalId" AS "goalId",
             g."groupId" AS "groupId",
             a."currentMetric",
             a."targetMetric",
             a."isDone"
      FROM "Activities" a
      LEFT JOIN "Tasks" t ON t.id = a."taskId"
      LEFT JOIN "Goals" g ON g.id = t."goalId"
    `);

    if (!Array.isArray(activities) || activities.length === 0) {
      await client.query("COMMIT");
      console.info(
        `monthlySnapshot: no activities to snapshot for ${snapshotMonthStr}`
      );
      return {
        ok: true,
        inserted: 0,
        skipped: 0,
        total: 0,
        month: snapshotMonthStr,
      };
    }

    let inserted = 0;
    let skipped = 0;
    let errors = 0;

    for (const a of activities) {
      // Prefer explicit numeric progress when available on the activity row.
      // Fallback to binary isDone -> 100/0 if no numeric progress is present.
      const progress =
        typeof a.progress === "number" && Number.isFinite(a.progress)
          ? Number(a.progress)
          : a.isDone
          ? 100
          : 0;

      const metricsObj = {
        currentMetric: a.currentMetric ?? null,
        targetMetric: a.targetMetric ?? null,
      };

      try {
        const res = await client.query(
          `INSERT INTO "ProgressHistory"
            (entity_type, entity_id, group_id, progress, metrics, snapshot_month, recorded_at)
           VALUES ($1, $2, $3, $4, $5::jsonb, $6, NOW())
           ON CONFLICT (entity_type, entity_id, snapshot_month) DO NOTHING
           RETURNING id`,
          // store entity_type normalized to lowercase to match report queries
          [
            "activity",
            a.id,
            a.groupId ?? null,
            progress,
            JSON.stringify(metricsObj),
            snapshotMonthStr,
          ]
        );

        if (res.rowCount && res.rowCount > 0) {
          inserted++;
        } else {
          skipped++;
        }
      } catch (rowErr) {
        console.error(
          "monthlySnapshot: failed to insert for activity",
          a.id,
          rowErr && rowErr.message ? rowErr.message : rowErr
        );
        errors++;
      }
    }

    await client.query("COMMIT");
    console.info(
      `monthlySnapshot: snapshotMonth=${snapshotMonthStr} complete. activities=${activities.length} inserted=${inserted} skipped=${skipped} errors=${errors}`
    );
    return {
      ok: true,
      inserted,
      skipped,
      errors,
      total: activities.length,
      month: snapshotMonthStr,
    };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(
      "monthlySnapshot error",
      err && err.message ? err.message : err
    );
    return { ok: false, error: String(err) };
  } finally {
    try {
      await client
        .query("SELECT pg_advisory_unlock($1)", [ADVISORY_LOCK_KEY])
        .catch(() => {});
    } finally {
      client.release();
    }
  }
}

/**
 * Snapshot a single activity's current metrics/progress for a given month.
 * This performs an upsert so it will update an existing row for the same month.
 * @param {number} activityId
 * @param {string|Date} snapshotMonthInput - optional month (Date or parsable string); defaults to current month start
 */
async function snapshotActivity(activityId, snapshotMonthInput) {
  if (!activityId) return { ok: false, error: "invalid activityId" };
  const pool = db;
  const client = await pool.connect();
  try {
    const snapshotMonthDate = snapshotMonthInput
      ? new Date(snapshotMonthInput)
      : monthStartFromDate(new Date());
    const snapshotMonthDateStart = monthStartFromDate(snapshotMonthDate);
    const snapshotMonthStr = snapshotMonthDateStart.toISOString().slice(0, 10);

    // fetch the activity current state
    const { rows } = await client.query(
      `SELECT a.id, a."currentMetric", a."targetMetric", a."progress", a."isDone", t."goalId" as "goalId", g."groupId" as "groupId"
       FROM "Activities" a
       LEFT JOIN "Tasks" t ON t.id = a."taskId"
       LEFT JOIN "Goals" g ON g.id = t."goalId"
       WHERE a.id = $1 LIMIT 1`,
      [activityId]
    );
    const a = rows[0];
    if (!a) return { ok: false, error: "activity not found" };

    const progress =
      typeof a.progress === "number" && Number.isFinite(a.progress)
        ? Number(a.progress)
        : a.isDone
        ? 100
        : 0;
    const metricsObj = {
      currentMetric: a.currentMetric ?? null,
      targetMetric: a.targetMetric ?? null,
    };

    const res = await client.query(
      `INSERT INTO "ProgressHistory"
         (entity_type, entity_id, group_id, progress, metrics, snapshot_month, recorded_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, NOW())
       ON CONFLICT (entity_type, entity_id, snapshot_month) DO UPDATE
         SET progress = EXCLUDED.progress, metrics = EXCLUDED.metrics, recorded_at = NOW()
       RETURNING id`,
      [
        "activity",
        activityId,
        a.groupId ?? null,
        progress,
        JSON.stringify(metricsObj),
        snapshotMonthStr,
      ]
    );

    return {
      ok: true,
      inserted: res.rowCount > 0 ? 1 : 0,
      id: res.rows?.[0]?.id || null,
      month: snapshotMonthStr,
    };
  } catch (err) {
    console.error(
      "snapshotActivity error",
      err && err.message ? err.message : err
    );
    return { ok: false, error: String(err) };
  } finally {
    client.release();
  }
}

async function ensureMonthlySnapshotsOnStartup() {
  const pool = db;
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT MAX(snapshot_month) AS last_month
      FROM "ProgressHistory"
      WHERE lower(entity_type) = 'activity'
    `);

    let lastMonth = res.rows?.[0]?.last_month
      ? new Date(res.rows[0].last_month)
      : null;
    const nowMonthStart = monthStartFromDate(new Date());

    if (!lastMonth) {
      console.info(
        "monthlySnapshot: no previous snapshots found in DB. Taking snapshot for current month."
      );
      const result = await snapshotMonthForAllActivities(nowMonthStart);
      return result;
    }

    lastMonth = monthStartFromDate(lastMonth);

    if (lastMonth.getTime() >= nowMonthStart.getTime()) {
      console.info(
        "monthlySnapshot: latest snapshot already present for month",
        formatSnapshotMonth(lastMonth)
      );
      return { ok: true, skipped: 0 };
    }

    const monthsToDo = [];
    let cur = new Date(
      Date.UTC(lastMonth.getUTCFullYear(), lastMonth.getUTCMonth() + 1, 1)
    );
    while (cur.getTime() <= nowMonthStart.getTime()) {
      monthsToDo.push(new Date(cur));
      cur = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 1));
    }

    console.info(
      "monthlySnapshot: missing months detected. Will snapshot for months:",
      monthsToDo.map((m) => formatSnapshotMonth(m)).join(", ")
    );

    const results = [];
    for (const m of monthsToDo) {
      const r = await snapshotMonthForAllActivities(m);
      results.push({ month: formatSnapshotMonth(m), result: r });
    }

    return { ok: true, results };
  } catch (err) {
    console.error(
      "ensureMonthlySnapshotsOnStartup error",
      err && err.message ? err.message : err
    );
    return { ok: false, error: String(err) };
  } finally {
    client.release();
  }
}

function scheduleMonthlySnapshots({
  schedule = "0 9 1 * *",
  timezone = undefined,
} = {}) {
  (async () => {
    try {
      console.info("monthlySnapshot: running startup catch-up check...");
      const r = await ensureMonthlySnapshotsOnStartup();
      console.info(
        "monthlySnapshot: startup check done.",
        r && r.ok ? "OK" : "ERROR",
        r
      );
    } catch (e) {
      console.error(
        "monthlySnapshot: startup catch-up failed",
        e && e.message ? e.message : e
      );
    }
  })();

  const task = cron.schedule(
    schedule,
    async () => {
      try {
        const snapshotMonth = monthStartFromDate(new Date());
        console.info(
          "monthlySnapshot: cron triggered for",
          formatSnapshotMonth(snapshotMonth)
        );
        await snapshotMonthForAllActivities(snapshotMonth);
      } catch (err) {
        console.error(
          "monthlySnapshot: cron job failed",
          err && err.message ? err.message : err
        );
      }
    },
    {
      scheduled: true,
      timezone,
    }
  );

  console.info(
    `monthlySnapshot: scheduled with cron "${schedule}"${
      timezone ? " tz=" + timezone : ""
    }`
  );
  return { task };
}

module.exports = {
  snapshotMonthForAllActivities,
  ensureMonthlySnapshotsOnStartup,
  scheduleMonthlySnapshots,
};

// Export the single-activity snapshot for other modules to call
module.exports.snapshotActivity = snapshotActivity;

if (require.main === module) {
  (async () => {
    const result = await snapshotMonthForAllActivities(new Date());
    console.log("monthlySnapshot (CLI) result:", result);
    process.exit(result && result.ok ? 0 : 1);
  })();
}
