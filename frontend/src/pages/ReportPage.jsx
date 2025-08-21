export default function ReportPage() {
  return(
    <div>
      <h1>this is ReportPage</h1>
    <p>the same goes for this also i copyed all because i was soo tied </p>
    </div>
  )
}
// This looks really good 👍 — you’ve implemented **report submission, review, and fetching** with progress-tracking updates!
// I’ll point out a few **critical issues and improvements** you may want to fix before deploying:

// ---

// ## 🔎 Issues I See

// ### 1. **SQL JOIN order bug in `getReportsByGroup`**

// Your query:

// ```sql
// SELECT r.*, u.username, array_agg(json_build_object('id', a.id, 'fileName', a."fileName")) AS attachments
// FROM "Reports" r
// JOIN "Users" u ON r."userId" = u.id
// JOIN "Activities" act ON r."activityId" = act.id
// WHERE act."groupId" = $1
// LEFT JOIN "Attachments" a ON r.id = a."reportId"
// GROUP BY r.id, u.username
// ```

// 🚨 Problem: In Postgres, `LEFT JOIN` must come **before** `WHERE`.
// As written, you’ll get a syntax error.

// ✅ Fix:

// ```sql
// SELECT r.*, u.username, array_agg(json_build_object('id', a.id, 'fileName', a."fileName")) AS attachments
// FROM "Reports" r
// JOIN "Users" u ON r."userId" = u.id
// JOIN "Activities" act ON r."activityId" = act.id
// LEFT JOIN "Attachments" a ON r.id = a."reportId"
// WHERE act."groupId" = $1
// GROUP BY r.id, u.username
// ```

// ---

// ### 2. **No check for missing report in `reviewReport`**

// You assume the report always exists:

// ```js
// const reportRes = await client.query(
//   'SELECT "activityId" FROM "Reports" WHERE id = $1',
//   [reportId]
// );
// const { activityId } = reportRes.rows[0];
// ```

// If `reportId` doesn’t exist → `rows[0]` is `undefined` → crash.
// ✅ Fix:

// ```js
// if (!reportRes.rows[0]) {
//   await client.query("ROLLBACK");
//   return res.status(404).json({ message: "Report not found" });
// }
// ```

// ---

// ### 3. **`getMyReports` & attachments**

// You’re using `array_agg` without filtering nulls. If a report has **no attachments**, Postgres will still return `[ { id: null, fileName: null } ]`.

// ✅ Fix: use `FILTER`:

// ```sql
// array_agg(
//   json_build_object('id', a.id, 'fileName', a."fileName")
// ) FILTER (WHERE a.id IS NOT NULL) AS attachments
// ```

// ---

// ### 4. **File cleanup only on failure**

// In `submitReport`, you clean up files only if DB fails.
// But if DB succeeds but later request times out or `res.send` errors, files could still stay in FS.
// You might want to move cleanup into a **finally block** if something goes wrong.

// ---

// ### 5. **`metrics_data` JSON safety**

// You insert `metrics_data` directly:

// ```js
// 'INSERT INTO "Reports" ("activityId", "userId", narrative, metrics_data) VALUES ($1, $2, $3, $4)'
// ```

// If `metrics_data` isn’t validated, malformed JSON could break later queries.
// ✅ Suggestion: validate/parse before insert:

// ```js
// let metrics = null;
// try {
//   metrics = JSON.parse(metrics_data);
// } catch {
//   return res.status(400).json({ message: "Invalid metrics_data JSON." });
// }
// ```

// ---

// ### 6. **Permissions**

// Right now:

// * `getReportsByGroup` → anyone who calls it can fetch all reports for a group.
// * `getAllReports` → no role check, any authenticated user could hit it.

// ✅ Fix: check roles/permissions (like `req.user.role === "admin"` or `req.user.permissions.includes("view_all_reports")`).

// ---

// ## ✅ Refined Snippet Example (fixing `getReportsByGroup`)

// ```js
// exports.getReportsByGroup = async (req, res) => {
//   try {
//     const { groupId } = req.params;

//     // Security check: ensure user is manager/admin of this group
//     if (!req.user.permissions.includes("manage_reports")) {
//       return res.status(403).json({ message: "Not authorized" });
//     }

//     const { rows } = await db.query(
//       `SELECT r.*, u.username, 
//               array_agg(json_build_object('id', a.id, 'fileName', a."fileName")) 
//               FILTER (WHERE a.id IS NOT NULL) AS attachments
//        FROM "Reports" r
//        JOIN "Users" u ON r."userId" = u.id
//        JOIN "Activities" act ON r."activityId" = act.id
//        LEFT JOIN "Attachments" a ON r.id = a."reportId"
//        WHERE act."groupId" = $1
//        GROUP BY r.id, u.username`,
//       [groupId]
//     );
//     res.status(200).json(rows);
//   } catch (error) {
//     console.error("Error getting group reports:", error);
//     res.status(500).json({ message: "Internal server error." });
//   }
// };
// ```

// ---

// ⚡ So overall:

// * Fix SQL JOIN order
// * Add missing `404` checks
// * Clean up attachments aggregation
// * Add proper role/permission checks

// ---

// 👉 Do you want me to refactor this whole controller into **modular services** (reportService, attachmentService, etc.) for cleaner separation, or do you prefer to keep everything in a single controller file?
