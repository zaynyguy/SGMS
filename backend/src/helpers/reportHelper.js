// src/helpers/reportHelper.js
function escapeHtml(s) {
  if (!s && s !== 0) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function generateReportHtml(rows) {
  // rows may contain repeated goal/task/activity/report attachments.
  // We'll group them into nested objects.
  const goals = new Map();

  for (const r of rows) {
    const goalId = r.goal_id || null;
    if (!goals.has(goalId)) {
      goals.set(goalId, {
        id: goalId,
        title: r.goal_title || '—',
        progress: r.goal_progress || 0,
        status: r.goal_status || '—',
        tasks: new Map()
      });
    }
    const g = goals.get(goalId);

    const taskId = r.task_id || null;
    if (taskId !== null) {
      if (!g.tasks.has(taskId)) {
        g.tasks.set(taskId, {
          id: taskId,
          title: r.task_title || '—',
          progress: r.task_progress || 0,
          status: r.task_status || '—',
          assignee: r.task_assignee || null,
          activities: new Map()
        });
      }
      const t = g.tasks.get(taskId);

      const actId = r.activity_id || null;
      if (actId !== null) {
        if (!t.activities.has(actId)) {
          t.activities.set(actId, {
            id: actId,
            title: r.activity_title || '—',
            description: r.activity_description || '',
            currentMetric: r.currentmetric || r.current_metric || r.currentMetric || r.currentMetric,
            targetMetric: r.targetmetric || r.target_metric || r.targetMetric || r.targetMetric,
            weight: r.activity_weight || 0,
            isDone: r.activity_done || false,
            status: r.activity_status || '—',
            reports: []
          });
        }
        const a = t.activities.get(actId);

        if (r.report_id) {
          a.reports.push({
            id: r.report_id,
            narrative: r.report_narrative,
            status: r.report_status,
            metrics: r.report_metrics,
            new_status: r.report_new_status,
            createdAt: r.report_createdat,
            attachments: r.attachment_id ? [{
              id: r.attachment_id,
              name: r.attachment_name,
              path: r.attachment_path,
              type: r.attachment_type
            }] : []
          });
        }
      }
    }
  }

  // Now render HTML
  let html = `
  <!doctype html>
  <html>
  <head>
    <meta charset="utf-8">
    <title>Master Report</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial; margin: 20px; color: #222; }
      header { display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; }
      h1 { font-size: 22px; margin:0; }
      .controls { text-align:right; }
      .btn { display:inline-block; padding:8px 12px; border-radius:6px; background:#007bff; color:#fff; text-decoration:none; margin-left:8px;}
      .section { margin-bottom: 28px; border-bottom:1px solid #eee; padding-bottom:14px; }
      .goal { margin-bottom: 12px; }
      table { width:100%; border-collapse:collapse; margin-top:8px; }
      th, td { border:1px solid #e9e9e9; padding:8px; text-align:left; font-size:13px; }
      th { background:#f7f7f7; font-weight:600; }
      .small { font-size:12px; color:#666; }
      .progress { background:#f1f1f1; border-radius:6px; overflow:hidden; height:10px; width:100px; display:inline-block; vertical-align:middle; margin-left:8px; }
      .progress > i { display:block; height:100%; background:#4CAF50; }
      .report-block { background:#fafafa; padding:10px; border-radius:6px; margin-top:8px; }
    </style>
  </head>
  <body>
    <header>
      <h1>Master Report</h1>
      <div class="controls">
        <a class="btn" href="#" onclick="window.print();return false;">Print / Save as PDF</a>
      </div>
    </header>
  `;

  for (const [gid, g] of goals) {
    html += `<div class="section"><div class="goal"><h2>Goal: ${escapeHtml(g.title || '—')}</h2>`;
    html += `<div class="small">Status: ${escapeHtml(g.status)} | Progress: ${escapeHtml(String(g.progress))}%</div>`;
    html += `</div>`;

    // tasks table
    html += `<table><thead><tr><th>Task</th><th>Assignee</th><th>Status</th><th>Progress</th><th>Weight</th></tr></thead><tbody>`;
    for (const [tid, t] of g.tasks) {
      html += `<tr>
        <td>${escapeHtml(t.title || '—')}</td>
        <td>${escapeHtml(String(t.assignee || '—'))}</td>
        <td>${escapeHtml(t.status)}</td>
        <td>${escapeHtml(String(t.progress))}%</td>
        <td>${escapeHtml(String(t.weight || '—'))}</td>
      </tr>`;
    }
    html += `</tbody></table>`;

    // activities per task
    for (const [tid, t] of g.tasks) {
      html += `<h3 style="margin-top:16px;">Activities for: ${escapeHtml(t.title)}</h3>`;
      html += `<table><thead><tr><th>Activity</th><th>Description</th><th>Metric (current → target)</th><th>Status</th><th>Weight</th></tr></thead><tbody>`;
      for (const [aid, a] of t.activities) {
        const cur = a.currentMetric ? escapeHtml(JSON.stringify(a.currentMetric)) : '—';
        const tgt = a.targetMetric ? escapeHtml(JSON.stringify(a.targetMetric)) : '—';
        html += `<tr>
          <td>${escapeHtml(a.title)}</td>
          <td>${escapeHtml(a.description || '')}</td>
          <td>${cur} → ${tgt}</td>
          <td>${escapeHtml(String(a.status || '—'))}${a.isDone ? ' ✅' : ''}</td>
          <td>${escapeHtml(String(a.weight || 0))}</td>
        </tr>`;

        // reports for activity
        if (a.reports && a.reports.length) {
          html += `<tr><td colspan="5"><div class="report-block"><strong>Reports</strong><br/>`;
          for (const rep of a.reports) {
            html += `<div style="margin-top:6px;"><strong>Report #${escapeHtml(String(rep.id))}</strong> (${escapeHtml(String(rep.status || '—'))}) <div class="small">Submitted: ${escapeHtml(String(rep.createdAt || '—'))}</div>`;
            html += `<div>${escapeHtml(String(rep.narrative || ''))}</div>`;
            if (rep.metrics) {
              html += `<div class="small">Metrics: ${escapeHtml(JSON.stringify(rep.metrics))}</div>`;
            }
            if (rep.attachments && rep.attachments.length) {
              html += `<div class="small">Attachments: ${rep.attachments.map(a=>escapeHtml(a.name)).join(', ')}</div>`;
            }
            html += `</div>`;
          }
          html += `</div></td></tr>`;
        }
      }
      html += `</tbody></table>`;
    }

    html += `</div>`; // section
  }

  html += `</body></html>`;
  return html;
}

module.exports = { generateReportHtml };
