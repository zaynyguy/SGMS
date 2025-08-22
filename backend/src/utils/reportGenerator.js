// This helper function builds the master HTML report.

function generateReportHtml(data) {
    let html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>SGMS Master Report</title>
        <style>
            body { font-family: sans-serif; line-height: 1.6; }
            .report { max-width: 800px; margin: auto; padding: 20px; }
            .table-of-contents, .narrations { border: 1px solid #ccc; padding: 15px; margin-bottom: 20px; }
            h1, h2, h3 { color: #333; }
            a { text-decoration: none; color: #0066cc; }
            ul { padding-left: 20px; }
            li { margin-bottom: 10px; }
        </style>
    </head>
    <body>
        <div class="report">
            <h1>Master Strategic Report</h1>
    `;

    // Process data to build a structured hierarchy
    const goals = {};
    data.forEach(row => {
        if (!row.goal_id) return;
        if (!goals[row.goal_id]) goals[row.goal_id] = { title: row.goal_title, tasks: {} };
        
        if (!row.task_id) return;
        if (!goals[row.goal_id].tasks[row.task_id]) goals[row.goal_id].tasks[row.task_id] = { title: row.task_title, activities: {} };
        
        if (!row.activity_id) return;
        if (!goals[row.goal_id].tasks[row.task_id].activities[row.activity_id]) {
            goals[row.goal_id].tasks[row.task_id].activities[row.activity_id] = { 
                title: row.activity_title, 
                description: row.activity_description,
                reports: []
            };
        }
        
        if (row.report_narrative) {
            // Avoid duplicate narratives
            if (!goals[row.goal_id].tasks[row.task_id].activities[row.activity_id].reports.some(r => r.narrative === row.report_narrative)) {
                 goals[row.goal_id].tasks[row.task_id].activities[row.activity_id].reports.push({
                     narrative: row.report_narrative,
                     attachment: row.attachment_id ? { id: row.attachment_id, name: row.fileName } : null
                 });
            }
        }
    });

    // Build Table of Contents
    html += '<div class="table-of-contents"><h2>Table of Contents</h2><ul>';
    let g_idx = 1;
    for (const goalId in goals) {
        const goal = goals[goalId];
        const goalNum = g_idx++;
        html += `<li><strong>${goalNum}. ${goal.title}</strong></li>`;
        let t_idx = 1;
        html += '<ul>';
        for (const taskId in goal.tasks) {
            const task = goal.tasks[taskId];
            const taskNum = `${goalNum}.${t_idx++}`;
            html += `<li>${taskNum}. ${task.title}</li>`;
            let a_idx = 1;
            html += '<ul>';
            for (const activityId in task.activities) {
                const activity = task.activities[activityId];
                const actNum = `${taskNum}.${a_idx++}`;
                html += `<li><a href="#narration-${actNum}">${actNum}. ${activity.title}</a></li>`;
            }
            html += '</ul>';
        }
        html += '</ul>';
    }
    html += '</ul></div>';

    // Build Narrations Section
    html += '<div class="narrations"><h2>Narrations & Descriptions</h2>';
    g_idx = 1;
    for (const goalId in goals) {
        const goal = goals[goalId];
        const goalNum = g_idx++;
        let t_idx = 1;
        for (const taskId in goal.tasks) {
            const task = goal.tasks[taskId];
            const taskNum = `${goalNum}.${t_idx++}`;
            let a_idx = 1;
            for (const activityId in task.activities) {
                const activity = task.activities[activityId];
                const actNum = `${taskNum}.${a_idx++}`;
                html += `<div id="narration-${actNum}" style="margin-bottom: 20px;">`;
                html += `<h3>${actNum}. ${activity.title}</h3>`;
                html += `<p><strong>Description:</strong> ${activity.description || 'N/A'}</p>`;
                html += '<h4>Approved Narratives:</h4>';
                if (activity.reports.length > 0) {
                    html += '<ul>';
                    activity.reports.forEach(report => {
                        html += `<li>${report.narrative}`;
                        if (report.attachment) {
                            // Link would point to a download route
                            html += ` <a href="/api/attachments/${report.attachment.id}/download">(${report.attachment.name})</a>`;
                        }
                        html += `</li>`;
                    });
                    html += '</ul>';
                } else {
                    html += '<p>No approved reports for this activity.</p>';
                }
                html += '</div>';
            }
        }
    }
    html += '</div></div></body></html>';
    return html;
}

module.exports = { generateReportHtml };