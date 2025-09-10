require('dotenv').config();
const db = require('../../src/db');

async function snapshotMonthly() {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const { rows: activities } = await client.query(
      `SELECT a.id, a."taskId", t."goalId", g."groupId", a."currentMetric", a.progress
       FROM "Activities" a
       JOIN "Tasks" t ON t.id = a."taskId"
       JOIN "Goals" g ON g.id = t."goalId"`
    );

    for (const a of activities) {
      await client.query(
        `INSERT INTO "ProgressHistory"("entity_type","entity_id","group_id","progress","metrics","recorded_at")
         VALUES ($1,$2,$3,$4,$5,NOW())`,
        ['Activity', a.id, a.groupId, a.progress || 0, a.currentmetric || {}]
      );
    }

    await client.query('COMMIT');
    console.log('Monthly snapshot written for', activities.length, 'activities.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('monthlySnapshot error', err);
    process.exitCode = 1;
  } finally {
    client.release();
  }
}

if (require.main === module) snapshotMonthly();
module.exports = snapshotMonthly;