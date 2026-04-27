const ExcelJS = require("exceljs");

function normalizeHeader(header) {
  if (header === null || header === undefined) return "";
  const str = String(header).trim();
  return str
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parseCellValue(value) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if (value.text !== undefined) return value.text;
    return value;
  }
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch (err) {
      return trimmed;
    }
  }
  return trimmed;
}

function parseWorksheet(worksheet) {
  const headers = [];
  const rows = [];

  const firstRow = worksheet.getRow(1);
  firstRow.eachCell((cell, colNumber) => {
    headers[colNumber] = normalizeHeader(cell.value);
  });

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const obj = {};
    let hasValue = false;
    row.eachCell((cell, colNumber) => {
      const header = headers[colNumber];
      if (!header) return;
      const value = parseCellValue(cell.value);
      obj[header] = value;
      if (value !== null && value !== undefined && value !== "") {
        hasValue = true;
      }
    });
    if (hasValue) rows.push(obj);
  });

  return rows;
}

function getSheetByName(workbook, name) {
  const exact = workbook.getWorksheet(name);
  if (exact) return exact;
  const lowered = name.toLowerCase();
  return workbook.worksheets.find(
    (sheet) => sheet.name.toLowerCase() === lowered,
  );
}

async function parseExcelWorkbook(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  return {
    goals: getSheetByName(workbook, "Goals")
      ? parseWorksheet(getSheetByName(workbook, "Goals"))
      : [],
    tasks: getSheetByName(workbook, "Tasks")
      ? parseWorksheet(getSheetByName(workbook, "Tasks"))
      : [],
    activities: getSheetByName(workbook, "Activities")
      ? parseWorksheet(getSheetByName(workbook, "Activities"))
      : [],
    reports: getSheetByName(workbook, "Reports")
      ? parseWorksheet(getSheetByName(workbook, "Reports"))
      : [],
  };
}

function buildMasterWorkbook(masterJson) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SGMS";
  workbook.created = new Date();

  const goalsSheet = workbook.addWorksheet("Goals");
  goalsSheet.columns = [
    { header: "goal_id", key: "id", width: 10 },
    { header: "title", key: "title", width: 30 },
    { header: "progress", key: "progress", width: 12 },
    { header: "status", key: "status", width: 16 },
    { header: "weight", key: "weight", width: 12 },
  ];

  const tasksSheet = workbook.addWorksheet("Tasks");
  tasksSheet.columns = [
    { header: "task_id", key: "id", width: 10 },
    { header: "goal_id", key: "goalId", width: 10 },
    { header: "title", key: "title", width: 30 },
    { header: "progress", key: "progress", width: 12 },
    { header: "status", key: "status", width: 16 },
    { header: "weight", key: "weight", width: 12 },
    { header: "assignee", key: "assignee", width: 20 },
  ];

  const activitiesSheet = workbook.addWorksheet("Activities");
  activitiesSheet.columns = [
    { header: "activity_id", key: "id", width: 10 },
    { header: "task_id", key: "taskId", width: 10 },
    { header: "title", key: "title", width: 30 },
    { header: "description", key: "description", width: 40 },
    { header: "status", key: "status", width: 16 },
    { header: "metric_type", key: "metricType", width: 16 },
    { header: "target_metric", key: "targetMetric", width: 30 },
    { header: "current_metric", key: "currentMetric", width: 30 },
    { header: "previous_metric", key: "previousMetric", width: 30 },
    { header: "quarterly_goals", key: "quarterlyGoals", width: 30 },
    { header: "weight", key: "weight", width: 12 },
    { header: "is_done", key: "isDone", width: 10 },
  ];

  const reportsSheet = workbook.addWorksheet("Reports");
  reportsSheet.columns = [
    { header: "report_id", key: "id", width: 10 },
    { header: "activity_id", key: "activityId", width: 10 },
    { header: "narrative", key: "narrative", width: 50 },
    { header: "status", key: "status", width: 16 },
    { header: "new_status", key: "newStatus", width: 16 },
    { header: "metrics", key: "metrics", width: 40 },
    { header: "created_at", key: "createdAt", width: 20 },
  ];

  for (const goal of masterJson.goals || []) {
    goalsSheet.addRow({
      id: goal.id,
      title: goal.title,
      progress: goal.progress,
      status: goal.status,
      weight: goal.weight,
    });
    for (const task of goal.tasks || []) {
      tasksSheet.addRow({
        id: task.id,
        goalId: goal.id,
        title: task.title,
        progress: task.progress,
        status: task.status,
        weight: task.weight,
        assignee: task.assignee,
      });
      for (const activity of task.activities || []) {
        activitiesSheet.addRow({
          id: activity.id,
          taskId: task.id,
          title: activity.title,
          description: activity.description,
          status: activity.status,
          metricType: activity.metricType,
          targetMetric: JSON.stringify(activity.targetMetric || {}),
          currentMetric: JSON.stringify(activity.currentMetric || {}),
          previousMetric: JSON.stringify(activity.previousMetric || {}),
          quarterlyGoals: JSON.stringify(activity.quarterlyGoals || {}),
          weight: activity.weight,
          isDone: activity.isDone ? true : false,
        });
        for (const rep of activity.reports || []) {
          reportsSheet.addRow({
            id: rep.id,
            activityId: activity.id,
            narrative: rep.narrative,
            status: rep.status,
            newStatus: rep.new_status,
            metrics: JSON.stringify(rep.metrics || {}),
            createdAt: rep.createdAt,
          });
        }
      }
    }
  }

  [goalsSheet, tasksSheet, activitiesSheet, reportsSheet].forEach((sheet) => {
    sheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        if (rowNumber === 1) cell.font = { bold: true };
      });
    });
  });

  return workbook;
}

module.exports = {
  buildMasterWorkbook,
  parseExcelWorkbook,
};
