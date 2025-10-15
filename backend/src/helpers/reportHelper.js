// src/helpers/reportsHelper.js

/**
 * Escapes HTML special characters to prevent XSS.
 * @param {*} s The input to escape.
 * @returns {string} The escaped string.
 */
function escapeHtml(s) {
    if (!s && s !== 0) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/**
 * Generates a master report HTML from database rows.
 * @param {Array<Object>} rows The raw data from the database.
 * @returns {string} The complete HTML document.
 */
function generateReportHtml(rows) {
    // --- 1. Icon & Component Helpers ---

    const ICONS = {
        goal: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path><path d="M12 16c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4z"></path><path d="M12 12v.01"></path></svg>',
        task: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>',
        user: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>',
        report: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>',
        calendar: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>',
        attachment: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>',
        print: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>'
    };

    function getIcon(name) {
        return `<span class="icon">${ICONS[name] || ''}</span>`;
    }

    function formatMetrics(metric) {
        if (!metric || typeof metric !== 'object' || Object.keys(metric).length === 0) {
            return '<span class="metric-empty">—</span>';
        }
        return `<div class="metric-grid">` + Object.entries(metric)
            .map(([key, value]) => `<div class="metric-key">${escapeHtml(key)}</div><div class="metric-value">${escapeHtml(value)}</div>`)
            .join('') + `</div>`;
    }

    function getStatusBadge(status) {
        if (!status) return '—';
        let className = 'default';
        switch (String(status).toLowerCase()) {
            case 'completed': case 'done': case 'approved': className = 'success'; break;
            case 'in progress': className = 'primary'; break;
            case 'on hold': case 'blocked': case 'pending': className = 'warning'; break;
            case 'not started': case 'to do': case 'rejected': className = 'danger'; break;
        }
        return `<span class="badge badge-${className}">${escapeHtml(status)}</span>`;
    }

    function renderProgressBar(progress = 0) {
        const p = Math.max(0, Math.min(100, progress));
        return `<div class="progress-bar-container"><div class="progress-bar-inner" style="width: ${p}%;">${p}%</div></div>`;
    }

    // --- 2. Data Aggregation (no changes here) ---
    const goals = new Map();
    for (const r of rows) {
        const goalId = r.goal_id || null;
        if (!goals.has(goalId)) goals.set(goalId, { id: goalId, title: r.goal_title || '—', progress: r.goal_progress || 0, status: r.goal_status || '—', tasks: new Map() });
        const g = goals.get(goalId);
        const taskId = r.task_id || null;
        if (taskId !== null) {
            if (!g.tasks.has(taskId)) g.tasks.set(taskId, { id: taskId, title: r.task_title || '—', progress: r.task_progress || 0, status: r.task_status || '—', assignee: r.task_assignee || null, activities: new Map() });
            const t = g.tasks.get(taskId);
            const actId = r.activity_id || null;
            if (actId !== null) {
                if (!t.activities.has(actId)) t.activities.set(actId, { id: actId, title: r.activity_title || '—', description: r.activity_description || '', currentMetric: r.currentMetric, targetMetric: r.targetMetric, status: r.activity_status || '—', reports: new Map() });
                const a = t.activities.get(actId);
                if (r.report_id && !a.reports.has(r.report_id)) a.reports.set(r.report_id, { id: r.report_id, narrative: r.report_narrative, status: r.report_status, metrics: r.report_metrics, createdAt: r.report_createdAt, attachments: [] });
                if (r.attachment_id) {
                    const report = a.reports.get(r.report_id);
                    if (report && !report.attachments.some(att => att.id === r.attachment_id)) report.attachments.push({ id: r.attachment_id, name: r.attachment_name, });
                }
            }
        }
    }
    const generationDate = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    // --- 3. HTML Generation ---
    let html = `
    <!doctype html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Master Report</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            :root {
                --font-family-sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                --color-text-primary: #1a202c; --color-text-secondary: #4a5568; --color-text-muted: #718096;
                --color-primary: #3182ce; --color-success: #38a169; --color-success-dark: #2f855a; --color-warning: #d69e2e; --color-danger: #e53e3e; --color-default: #718096;
                --color-bg-body: #f7fafc; --color-bg-card: #ffffff; --color-border: #e2e8f0;
                --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.04);
                --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
                --border-radius: 0.5rem;
            }
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
            
            /* --- Base & Typography --- */
            body { font-family: var(--font-family-sans); margin: 0; background-color: var(--color-bg-body); color: var(--color-text-primary); line-height: 1.6; }
            .container { max-width: 90vw; margin: 2rem auto; padding: 0 1rem; }
            h1, h2, h3 { font-weight: 600; line-height: 1.3; }
            h1 { font-size: 2.25rem; } h2 { font-size: 1.5rem; } h3 { font-size: 1.25rem; }
            p { margin: 0 0 1rem; }
            
            /* --- Header & Page Controls --- */
            .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
            .report-title h1 { margin: 0; }
            .report-title .subtitle { font-size: 1.1rem; color: var(--color-text-secondary); margin: 0; }
            .print-btn { display: inline-flex; align-items: center; gap: 0.5rem; background-color: var(--color-primary); color: white; border: none; padding: 0.75rem 1.25rem; border-radius: var(--border-radius); font-weight: 600; cursor: pointer; transition: background-color 0.2s; }
            .print-btn:hover { background-color: #2b6cb0; }
            
            /* --- Layout & Cards --- */
            .goal-card { background-color: var(--color-bg-card); border-radius: var(--border-radius); box-shadow: var(--shadow-lg); margin-bottom: 2.5rem; }
            .goal-card-header { display: flex; align-items: center; gap: 1rem; padding: 1.5rem; border-bottom: 1px solid var(--color-border); }
            .goal-card-header h2 { flex-grow: 1; margin: 0; }
            .goal-card-body { padding: 1.5rem; }
            .task-block { border: 1px solid var(--color-border); border-radius: var(--border-radius); margin-bottom: 1.5rem; }
            .task-header { display: flex; align-items: center; gap: 1rem; padding: 1rem; background-color: #fcfdff; border-bottom: 1px solid var(--color-border); }
            .task-header h3 { flex-grow: 1; margin: 0; }
            .task-meta { display: flex; align-items: center; gap: 1.5rem; padding: 1rem; flex-wrap: wrap; }
            .task-meta-item { display: flex; align-items: center; gap: 0.5rem; color: var(--color-text-secondary); font-size: 0.9rem; }
            
            /* --- Tables & Lists --- */
            table { width:100%; border-collapse:collapse; }
            th, td { padding: 1rem 1.5rem; text-align: left; font-size: 0.9rem; border-bottom: 1px solid var(--color-border); vertical-align: top; }
            thead th { background: #f9fafb; color: var(--color-text-muted); text-transform: uppercase; font-size: 0.75rem; font-weight: 500; letter-spacing: 0.05em; }
            tbody tr:last-child td { border-bottom: none; }
            .empty-state { text-align: center; padding: 2rem; color: var(--color-text-muted); }
            
            /* --- Components --- */
            .icon { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; color: var(--color-text-secondary); flex-shrink: 0; }
            .goal-card-header .icon { color: var(--color-primary); }
            .badge { display: inline-block; padding: .25em .6em; font-size: 85%; font-weight: 600; line-height: 1; text-align: center; border-radius: 9999px; }
            .badge-primary { color: #fff; background-color: var(--color-primary); } .badge-success { color: #fff; background-color: var(--color-success); }
            .badge-warning { color: #fff; background-color: var(--color-warning); } .badge-danger { color: #fff; background-color: var(--color-danger); }
            .badge-default { color: #fff; background-color: var(--color-default); }
            .progress-bar-container { width: 150px; height: 1.25rem; background-color: #e2e8f0; border-radius: 9999px; box-shadow: inset 0 2px 4px rgba(0,0,0,0.1); }
            .progress-bar-inner { display: flex; align-items: center; justify-content: center; height: 100%; background-image: linear-gradient(to bottom, var(--color-success), var(--color-success-dark)); color: white; font-weight: 600; font-size: 0.75rem; border-radius: 9999px; }
            .metrics-comparison { display: flex; align-items: center; gap: 1rem; }
            .metrics-comparison .arrow { font-size: 1.5rem; color: var(--color-text-muted); }
            .metric-grid { display: grid; grid-template-columns: auto 1fr; gap: 0.25rem 0.75rem; align-items: center; }
            .metric-key { font-weight: 500; color: var(--color-text-secondary); text-align: right; }
            .metric-value { font-weight: 600; }
            .metric-empty { color: var(--color-text-muted); }
            
            /* --- Report Block --- */
            .report-wrapper { background: #f9fafb; padding: 1rem; margin-top: 1rem; border-radius: var(--border-radius); border: 1px solid var(--color-border); }
            .report-wrapper h4 { margin: 0 0 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--color-border); display: flex; align-items: center; gap: 0.5rem; }
            .report-item { margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px dashed var(--color-border); }
            .report-item:last-child { margin-bottom: 0; padding-bottom: 0; border-bottom: none; }
            .report-meta, .report-attachments { display: flex; align-items: center; gap: 0.5rem; color: var(--color-text-secondary); font-size: 0.85rem; margin-bottom: 0.5rem; flex-wrap: wrap; }
            
            /* --- Print Styles --- */
            @media print {
                body { background-color: #fff; }
                .container { max-width: 100%; margin: 0; padding: 0; }
                .page-header { display: none; }
                .goal-card { box-shadow: none; border: 1px solid var(--color-border); page-break-inside: avoid; }
                .task-block { page-break-inside: avoid; }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <header class="page-header">
                <div class="report-title">
                    <h1>Master Report</h1>
                    <p class="subtitle">Generated on ${generationDate}</p>
                </div>
                <button class="print-btn" onclick="window.print()">${getIcon('print')} <span>Print / Save PDF</span></button>
            </header>`;

    if (goals.size === 0) {
        html += `<div class="goal-card"><div class="goal-card-body empty-state"><p>No goals or data available for this report.</p></div></div>`;
    } else {
        for (const [gid, g] of goals) {
            html += `
            <div class="goal-card">
                <div class="goal-card-header">
                    ${getIcon('goal')} <h2>${escapeHtml(g.title)}</h2> ${getStatusBadge(g.status)}
                </div>
                <div class="goal-card-body">`;
            
            if (g.tasks.size === 0) {
                html += `<div class="empty-state"><p>This goal has no tasks.</p></div>`;
            } else {
                for (const [tid, t] of g.tasks) {
                    html += `
                    <div class="task-block">
                        <div class="task-header">
                            ${getIcon('task')} <h3>${escapeHtml(t.title)}</h3>
                        </div>
                        <div class="task-meta">
                            <div class="task-meta-item">${getIcon('user')} <strong>Assignee:</strong> ${escapeHtml(t.assignee || 'Unassigned')}</div>
                            <div class="task-meta-item"><strong>Status:</strong> ${getStatusBadge(t.status)}</div>
                            <div class="task-meta-item"><strong>Progress:</strong> ${renderProgressBar(t.progress)}</div>
                        </div>
                        
                        <div style="overflow-x: auto;">
                        <table>
                            <thead><tr>
                                <th style="width:25%">Activity</th>
                                <th>Metrics</th>
                                <th style="width:15%">Status</th>
                            </tr></thead>
                            <tbody>`;
                    
                    if (t.activities.size > 0) {
                        for (const [aid, a] of t.activities) {
                            const reports = Array.from(a.reports.values());
                            html += `
                            <tr>
                                <td>
                                    <p style="font-weight: 500; margin-bottom: 0.25rem;">${escapeHtml(a.title)}</p>
                                    <p style="font-size: 0.85rem; color: var(--color-text-secondary); margin:0;">${escapeHtml(a.description)}</p>
                                </td>
                                <td>
                                    <div class="metrics-comparison">
                                        ${formatMetrics(a.currentMetric)} 
                                        <span class="arrow">→</span> 
                                        ${formatMetrics(a.targetMetric)}
                                    </div>
                                </td>
                                <td>${getStatusBadge(a.status)}</td>
                            </tr>`;

                            if (reports.length > 0) {
                                html += `<tr><td colspan="3"><div class="report-wrapper"><h4>${getIcon('report')} Activity Reports</h4>`;
                                for (const rep of reports) {
                                    const reportDate = new Date(rep.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                                    html += `
                                    <div class="report-item">
                                        <div class="report-meta">
                                            <span><strong>Report #${rep.id}</strong></span> | <span>${getStatusBadge(rep.status)}</span> | <span style="display:inline-flex; align-items:center; gap: 0.25rem;">${getIcon('calendar')} ${reportDate}</span>
                                        </div>
                                        <p>${escapeHtml(rep.narrative)}</p>
                                        <div style="margin-bottom: 0.5rem;"><strong>Metrics Reported:</strong> ${formatMetrics(rep.metrics)}</div>
                                        ${rep.attachments.length > 0 ? `<div class="report-attachments">${getIcon('attachment')} <strong>Attachments:</strong> ${rep.attachments.map(att => escapeHtml(att.name)).join(', ')}</div>` : ''}
                                    </div>`;
                                }
                                html += `</div></td></tr>`;
                            }
                        }
                    } else {
                        html += `<tr><td colspan="3"><div class="empty-state">No activities for this task.</div></td></tr>`;
                    }
                    html += `</tbody></table></div></div>`;
                }
            }
            html += `</div></div>`; // .goal-card-body, .goal-card
        }
    }

    html += `</div></body></html>`;
    return html;
}
function generateReportJson(rows) {
  const goals = new Map();

  // Helper: ensure nested maps/objects exist
  function getOrCreate(map, key, factory) {
    if (!map.has(key)) map.set(key, factory());
    return map.get(key);
  }

  for (const r of rows) {
    // treat NULL/undefined ids gracefully
    const gid = r.goal_id ?? null;
    const tid = r.task_id ?? null;
    const aid = r.activity_id ?? null;

    // create goal
    const goal = getOrCreate(goals, gid, () => ({
      id: gid,
      title: r.goal_title || null,
      progress: r.goal_progress ?? 0,
      status: r.goal_status || null,
      weight: typeof r.goal_weight !== 'undefined' ? Number(r.goal_weight) : null,
      tasks: new Map()
    }));

    // create task under goal (if exists)
    let task = null;
    if (tid !== null) {
      task = getOrCreate(goal.tasks, tid, () => ({
        id: tid,
        title: r.task_title || null,
        progress: r.task_progress ?? 0,
        status: r.task_status || null,
        assignee: r.task_assignee ?? null,
        weight: typeof r.task_weight !== 'undefined' ? Number(r.task_weight) : null,
        activities: new Map()
      }));
    }

    // create activity under task (if exists)
    if (aid !== null && task) {
      const act = getOrCreate(task.activities, aid, () => ({
        id: aid,
        title: r.activity_title || null,
        description: r.activity_description || null,
        // parenthesize the nullish coalescing part before using ||
        currentMetric: (r.currentMetric ?? r.currentmetric) || {},
        targetMetric: (r.targetMetric ?? r.targetmetric) || {},
        weight: typeof r.activity_weight !== 'undefined' ? Number(r.activity_weight) : 0,
        isDone: !!r.activity_done,
        status: r.activity_status || null,
        reports: []
      }));

      // add report (if exists)
      if (r.report_id) {
        // create a minimal report object; attachments (if any) added here
        const rep = {
          id: r.report_id,
          narrative: r.report_narrative || null,
          status: r.report_status || null,
          metrics: r.report_metrics || null,
          new_status: r.report_new_status || null,
          createdAt: r.report_createdAt || null,
          attachments: []
        };

        if (r.attachment_id) {
          rep.attachments.push({
            id: r.attachment_id,
            name: r.attachment_name,
            path: r.attachment_path,
            type: r.attachment_type
          });
        }

        act.reports.push(rep);
      }
    }
  }

  // Now convert maps -> arrays and merge duplicate report rows (attachments that came as separate rows)
  const goalsOut = [];
  for (const goal of goals.values()) {
    const tasksOut = [];
    for (const task of goal.tasks.values()) {
      const activitiesOut = [];
      for (const act of task.activities.values()) {
        // merge attachments for same report id (if duplicates were pushed)
        const mergedReportsMap = new Map();
        for (const rep of act.reports) {
          const id = rep.id;
          if (!mergedReportsMap.has(id)) mergedReportsMap.set(id, JSON.parse(JSON.stringify(rep)));
          else {
            // merge attachments arrays (avoid duplicates)
            const existing = mergedReportsMap.get(id);
            const aIds = new Set(existing.attachments.map(a => a.id));
            for (const att of rep.attachments || []) {
              if (!aIds.has(att.id)) {
                existing.attachments.push(att);
                aIds.add(att.id);
              }
            }
          }
        }
        const mergedReports = Array.from(mergedReportsMap.values()).sort((a,b)=> new Date(a.createdAt) - new Date(b.createdAt));

        // compute metric time series from APPROVED reports only
        const approvedReports = mergedReports.filter(r => r.status === 'Approved' && r.metrics);

        // monthly: take latest approved report metrics in each month (YYYY-MM)
        const monthly = {};
        for (const rep of approvedReports) {
          const dt = new Date(rep.createdAt);
          if (isNaN(dt)) continue;
          const ym = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`;
          // if first or newer than saved one, take it
          const prev = monthly[ym];
          if (!prev || new Date(rep.createdAt) > new Date(prev._ts)) {
            monthly[ym] = { _ts: rep.createdAt, metrics: rep.metrics };
          }
        }
        // remove _ts from monthly and keep metrics
        for (const k of Object.keys(monthly)) monthly[k] = monthly[k].metrics;

        // quarterly: for each quarter in the months collected, take the HIGHEST numeric value for each metric key
        const quarterly = {};
        function qKeyFromYM(ym) {
          const [y, m] = ym.split('-').map(Number);
          const q = Math.floor((m-1)/3) + 1;
          return `${y}-Q${q}`;
        }
        // build per metric maximum per quarter
        const perQuarter = {};
        for (const ym of Object.keys(monthly)) {
          const qk = qKeyFromYM(ym);
          const metrics = monthly[ym] || {};
          perQuarter[qk] = perQuarter[qk] || {};
          Object.entries(metrics).forEach(([mk, mv]) => {
            const vNum = Number(mv);
            if (!isNaN(vNum)) {
              perQuarter[qk][mk] = perQuarter[qk][mk] === undefined ? vNum : Math.max(perQuarter[qk][mk], vNum);
            } else {
              perQuarter[qk][mk] = mv;
            }
          });
        }
        Object.assign(quarterly, perQuarter);

        // annual: take the latest approved report metrics in that year (latest month)
        const annual = {};
        const yearlyLatest = {};
        for (const rep of approvedReports) {
          const dt = new Date(rep.createdAt);
          if (isNaN(dt)) continue;
          const y = dt.getFullYear();
          if (!yearlyLatest[y] || new Date(rep.createdAt) > new Date(yearlyLatest[y]._ts)) {
            yearlyLatest[y] = { _ts: rep.createdAt, metrics: rep.metrics };
          }
        }
        for (const y of Object.keys(yearlyLatest)) annual[y] = yearlyLatest[y].metrics;

        activitiesOut.push({
          id: act.id,
          title: act.title,
          description: act.description,
          currentMetric: act.currentMetric || {},
          targetMetric: act.targetMetric || {},
          weight: act.weight,
          isDone: act.isDone,
          status: act.status,
          reports: mergedReports,
          metricsHistory: {
            monthly,
            quarterly,
            annual
          }
        });
      } // activities loop

      tasksOut.push({
        id: task.id,
        title: task.title,
        progress: task.progress,
        status: task.status,
        assignee: task.assignee,
        weight: task.weight,
        activities: activitiesOut
      });
    } // tasks loop

    goalsOut.push({
      id: goal.id,
      title: goal.title,
      progress: goal.progress,
      status: goal.status,
      weight: goal.weight,
      tasks: tasksOut
    });
  } // goals loop

  return {
    generationDate: (new Date()).toISOString(),
    goals: goalsOut
  };
}

module.exports = { generateReportHtml, generateReportJson };