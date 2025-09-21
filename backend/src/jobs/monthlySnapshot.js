// src/jobs/monthlySnapshot.js
require('dotenv').config();
const cron = require('node-cron');
const db = require('../db'); // ensure this exports a pg Pool instance
const ADVISORY_LOCK_KEY = 9876543210;

function monthStartFromDate(d = new Date()) {
  const dt = new Date(d);
  const year = dt.getUTCFullYear();
  const month = dt.getUTCMonth();
  return new Date(Date.UTC(year, month, 1));
}
function formatSnapshotMonth(dt) {
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

// snapshotMonthInput: Date or date-string or omitted -> uses provided month
async function snapshotMonthForAllActivities(snapshotMonthInput) {
  const pool = db;
  const client = await pool.connect();
  try {
    const snapshotMonthDate = snapshotMonthInput ? new Date(snapshotMonthInput) : monthStartFromDate(new Date());
    const snapshotMonthDateStart = monthStartFromDate(snapshotMonthDate);
    const snapshotMonthStr = snapshotMonthDateStart.toISOString().slice(0, 10); // 'YYYY-MM-DD'

    // advisory lock so two processes cannot run concurrently
    const lockRes = await client.query('SELECT pg_try_advisory_lock($1) AS locked', [ADVISORY_LOCK_KEY]);
    if (!lockRes.rows?.[0]?.locked) {
      console.warn('monthlySnapshot: could not acquire advisory lock - another process may be running.');
      return { ok: false, reason: 'locked' };
    }

    await client.query('BEGIN');

    const { rows: activities } = await client.query(`
      SELECT a.id,
             a."taskId",
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
      await client.query('COMMIT');
      console.info(`monthlySnapshot: no activities to snapshot for ${snapshotMonthStr}`);
      return { ok: true, inserted: 0, skipped: 0, total: 0, month: snapshotMonthStr };
    }

    let inserted = 0;
    let skipped = 0;
    let errors = 0;

    for (const a of activities) {
      // compute a simple activity-level progress: if isDone -> 100 else 0
      // (Activities table in your schema doesn't have a numeric progress field)
      const progress = a.isDone ? 100 : 0;

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
          ['Activity', a.id, a.groupId ?? null, progress, JSON.stringify(metricsObj), snapshotMonthStr]
        );

        if (res.rowCount && res.rowCount > 0) {
          inserted++;
        } else {
          skipped++;
        }
      } catch (rowErr) {
        console.error('monthlySnapshot: failed to insert for activity', a.id, rowErr && rowErr.message ? rowErr.message : rowErr);
        errors++;
      }
    }

    await client.query('COMMIT');
    console.info(`monthlySnapshot: snapshotMonth=${snapshotMonthStr} complete. activities=${activities.length} inserted=${inserted} skipped=${skipped} errors=${errors}`);
    return { ok: true, inserted, skipped, errors, total: activities.length, month: snapshotMonthStr };
  } catch (err) {
    await client.query('ROLLBACK').catch(()=>{});
    console.error('monthlySnapshot error', err && err.message ? err.message : err);
    return { ok: false, error: String(err) };
  } finally {
    try {
      await client.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_KEY]).catch(()=>{});
    } finally {
      client.release();
    }
  }
}

async function ensureMonthlySnapshotsOnStartup() {
  const pool = db;
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT MAX(snapshot_month) AS last_month
      FROM "ProgressHistory"
      WHERE entity_type = 'Activity'
    `);

    let lastMonth = res.rows?.[0]?.last_month ? new Date(res.rows[0].last_month) : null;
    const nowMonthStart = monthStartFromDate(new Date());

    if (!lastMonth) {
      console.info('monthlySnapshot: no previous snapshots found in DB. Taking snapshot for current month.');
      const result = await snapshotMonthForAllActivities(nowMonthStart);
      return result;
    }

    // floor to month start
    lastMonth = monthStartFromDate(lastMonth);

    if (lastMonth.getTime() >= nowMonthStart.getTime()) {
      console.info('monthlySnapshot: latest snapshot already present for month', formatSnapshotMonth(lastMonth));
      return { ok: true, skipped: 0 };
    }

    // build list of months to generate (month after lastMonth up to current month)
    const monthsToDo = [];
    let cur = new Date(Date.UTC(lastMonth.getUTCFullYear(), lastMonth.getUTCMonth() + 1, 1));
    while (cur.getTime() <= nowMonthStart.getTime()) {
      monthsToDo.push(new Date(cur));
      cur = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 1));
    }

    console.info('monthlySnapshot: missing months detected. Will snapshot for months:', monthsToDo.map(m => formatSnapshotMonth(m)).join(', '));

    const results = [];
    for (const m of monthsToDo) {
      const r = await snapshotMonthForAllActivities(m);
      results.push({ month: formatSnapshotMonth(m), result: r });
    }

    return { ok: true, results };
  } catch (err) {
    console.error('ensureMonthlySnapshotsOnStartup error', err && err.message ? err.message : err);
    return { ok: false, error: String(err) };
  } finally {
    client.release();
  }
}

function scheduleMonthlySnapshots({ schedule = '0 9 1 * *', timezone = undefined } = {}) {
  // run startup catch-up immediately (async)
  (async () => {
    try {
      console.info('monthlySnapshot: running startup catch-up check...');
      const r = await ensureMonthlySnapshotsOnStartup();
      console.info('monthlySnapshot: startup check done.', r && r.ok ? 'OK' : 'ERROR', r);
    } catch (e) {
      console.error('monthlySnapshot: startup catch-up failed', e && e.message ? e.message : e);
    }
  })();

  const task = cron.schedule(schedule, async () => {
    try {
      const snapshotMonth = monthStartFromDate(new Date());
      console.info('monthlySnapshot: cron triggered for', formatSnapshotMonth(snapshotMonth));
      await snapshotMonthForAllActivities(snapshotMonth);
    } catch (err) {
      console.error('monthlySnapshot: cron job failed', err && err.message ? err.message : err);
    }
  }, {
    scheduled: true,
    timezone,
  });

  console.info(`monthlySnapshot: scheduled with cron "${schedule}"${timezone ? ' tz=' + timezone : ''}`);
  return { task };
}

// expose functions
module.exports = {
  snapshotMonthForAllActivities,
  ensureMonthlySnapshotsOnStartup,
  scheduleMonthlySnapshots,
};

// allows running this file directly for testing:
// e.g. node src/jobs/monthlySnapshot.js
if (require.main === module) {
  (async () => {
    const result = await snapshotMonthForAllActivities(new Date());
    console.log('monthlySnapshot (CLI) result:', result);
    process.exit(result && result.ok ? 0 : 1);
  })();
}
