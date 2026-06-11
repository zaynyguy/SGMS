const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");

function normalizeHeader(header) {
  return String(header)
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^a-zA-Z0-9 ]+/g, " ")
    .trim();
}

function formatJson(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "object") return JSON.stringify(value);
  return value;
}

function addRows(sheet, rows, converters) {
  for (const row of rows) {
    sheet.addRow(converters(row));
  }
}

function buildTemplateWorkbook(existingData = {}) {
  const workbook = new ExcelJS.Workbook();
  const goalsSheet = workbook.addWorksheet("Goals");
  const tasksSheet = workbook.addWorksheet("Tasks");
  const activitiesSheet = workbook.addWorksheet("Activities");
  const quarterSheets = [
    workbook.addWorksheet("Quarter1"),
    workbook.addWorksheet("Quarter2"),
    workbook.addWorksheet("Quarter3"),
    workbook.addWorksheet("Quarter4"),
  ];

  const goalHeader = [
    "goal_id",
    "goal_roll_no",
    "goal_title",
    "goal_description",
    "goal_group_id",
    "goal_group_name",
    "goal_status",
    "goal_weight",
    "goal_start_date",
    "goal_end_date",
  ];
  goalsSheet.addRow(goalHeader);

  const goals = Array.isArray(existingData.goals) ? existingData.goals : [];
  if (goals.length > 0) {
    addRows(goalsSheet, goals, (goal) => [
      goal.goal_id || null,
      goal.goal_roll_no || null,
      goal.goal_title || null,
      goal.goal_description || null,
      goal.goal_group_id || null,
      goal.goal_group_name || null,
      goal.goal_status || null,
      goal.goal_weight !== null && goal.goal_weight !== undefined ? goal.goal_weight : null,
      goal.goal_start_date || null,
      goal.goal_end_date || null,
    ]);
  } else {
    goalsSheet.addRow([
      null,
      null,
      "Increase customer retention",
      "Improve loyalty metrics",
      null,
      "Corporate",
      "In Progress",
      10,
      "2025-01-01",
      "2025-12-31",
    ]);
  }

  const taskHeader = [
    "task_id",
    "task_roll_no",
    "task_title",
    "task_description",
    "goal_id",
    "goal_roll_no",
    "task_status",
    "task_weight",
    "task_due_date",
    "task_assignee_id",
  ];
  tasksSheet.addRow(taskHeader);

  const tasks = Array.isArray(existingData.tasks) ? existingData.tasks : [];
  if (tasks.length > 0) {
    addRows(tasksSheet, tasks, (task) => [
      task.task_id || null,
      task.task_roll_no || null,
      task.task_title || null,
      task.task_description || null,
      task.goal_id || null,
      task.goal_roll_no || null,
      task.task_status || null,
      task.task_weight !== null && task.task_weight !== undefined ? task.task_weight : null,
      task.task_due_date || null,
      task.task_assignee_id || null,
    ]);
  } else {
    tasksSheet.addRow([
      null,
      null,
      "Launch loyalty campaign",
      "Create customer retention campaign",
      null,
      null,
      "To Do",
      5,
      "2025-03-31",
      null,
    ]);
  }

  const activityHeader = [
    "activity_id",
    "activity_roll_no",
    "activity_title",
    "activity_description",
    "task_id",
    "task_roll_no",
    "activity_status",
    "activity_weight",
    "activity_due_date",
    "activity_metric_type",
    "activity_target_metric",
    "activity_current_metric",
    "activity_previous_metric",
    "activity_is_done",
    "activity_quarterly_goals",
  ];
  activitiesSheet.addRow(activityHeader);

  const activities = Array.isArray(existingData.activities) ? existingData.activities : [];
  if (activities.length > 0) {
    addRows(activitiesSheet, activities, (activity) => [
      activity.activity_id || null,
      activity.activity_roll_no || null,
      activity.activity_title || null,
      activity.activity_description || null,
      activity.task_id || null,
      activity.task_roll_no || null,
      activity.activity_status || null,
      activity.activity_weight !== null && activity.activity_weight !== undefined ? activity.activity_weight : null,
      activity.activity_due_date || null,
      activity.activity_metric_type || null,
      formatJson(activity.activity_target_metric),
      formatJson(activity.activity_current_metric),
      formatJson(activity.activity_previous_metric),
      activity.activity_is_done === true ? true : false,
      formatJson(activity.activity_quarterly_goals || activity.quarterlyGoals),
    ]);
  } else {
    activitiesSheet.addRow([
      null,
      null,
      "Email nurture sequence",
      "Send weekly retention emails",
      null,
      null,
      "To Do",
      2.5,
      "2025-02-15",
      "Plus",
      JSON.stringify({ progress: 8 }),
      JSON.stringify({ progress: 0 }),
      JSON.stringify({ progress: 0 }),
      false,
      null,
    ]);
  }

  const quarterHeader = [
    "activity_id",
    "activity_roll_no",
    "activity_title",
    "planned",
    "actual",
    "remark",
    "metric_key",
    "fiscal_year",
  ];

  const quarters = Array.isArray(existingData.quarters) ? existingData.quarters : [];
  quarterSheets.forEach((sheet, index) => {
    sheet.addRow(quarterHeader);
    const quarterRows = quarters.filter((row) => Number(row.quarter) === index + 1);
    if (quarterRows.length > 0) {
      const grouped = new Map();
      for (const row of quarterRows) {
        const key = `${row.activity_id || ""}|${row.activity_roll_no || ""}|${row.metric_key || ""}|${row.fiscal_year || ""}`;
        const existing = grouped.get(key) || {
          activity_id: row.activity_id || null,
          activity_roll_no: row.activity_roll_no || null,
          activity_title: row.activity_title || null,
          planned: null,
          actual: null,
          remark: null,
          metric_key: row.metric_key || null,
          fiscal_year: row.fiscal_year || null,
        };
        if (row.planned !== null && row.planned !== undefined) existing.planned = row.planned;
        if (row.actual !== null && row.actual !== undefined) existing.actual = row.actual;
        if (row.remark !== null && row.remark !== undefined) existing.remark = row.remark;
        grouped.set(key, existing);
      }
      addRows(sheet, Array.from(grouped.values()), (row) => [
        row.activity_id || null,
        row.activity_roll_no || null,
        row.activity_title || null,
        row.planned !== null && row.planned !== undefined ? row.planned : null,
        row.actual !== null && row.actual !== undefined ? row.actual : null,
        row.remark || null,
        row.metric_key || null,
        row.fiscal_year || null,
      ]);
    } else {
      sheet.addRow([
        null,
        null,
        null,
        10,
        0,
        `Plan for Q${index + 1}`,
        "progress",
        new Date().getFullYear(),
      ]);
    }
  });

  return workbook;
}

async function generateTemplateFiles() {
  const outputFolder = path.join(__dirname, "..", "uploads");
  if (!fs.existsSync(outputFolder)) {
    fs.mkdirSync(outputFolder, { recursive: true });
  }
  const workbook = buildTemplateWorkbook();
  const filePath = path.join(outputFolder, "bulk-import-template.xlsx");
  await workbook.xlsx.writeFile(filePath);
  console.log(`Template written to ${filePath}`);
}

module.exports = {
  buildTemplateWorkbook,
  generateTemplateFiles,
};

if (require.main === module) {
  generateTemplateFiles().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
