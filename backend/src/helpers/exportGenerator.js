const ExcelJS = require("exceljs");

function buildCsvFromRows(rows, fields) {
  const header = fields.join(",");
  const lines = [header];
  rows.forEach((item) => {
    const values = fields.map((field) => {
      const value = item[field] === null || item[field] === undefined ? "" : String(item[field]);
      return JSON.stringify(value);
    });
    lines.push(values.join(","));
  });
  return lines.join("\n");
}

function createWorkbook() {
  return new ExcelJS.Workbook();
}

function buildSheet(workbook, title, rows, columns) {
  const worksheet = workbook.addWorksheet(title);
  worksheet.columns = columns;
  rows.forEach((row) => {
    const record = {};
    columns.forEach((col) => {
      record[col.key] = row[col.key] === null || row[col.key] === undefined ? "" : row[col.key];
    });
    worksheet.addRow(record);
  });
  return worksheet;
}

function buildGoalsWorkbook(rows) {
  const workbook = createWorkbook();
  buildSheet(workbook, "Goals", rows, [
    { header: "ID", key: "id", width: 10 },
    { header: "Title", key: "title", width: 40 },
    { header: "Description", key: "description", width: 50 },
    { header: "Group ID", key: "groupId", width: 12 },
    { header: "Status", key: "status", width: 18 },
    { header: "Progress", key: "progress", width: 12 },
    { header: "Weight", key: "weight", width: 10 },
    { header: "Start Date", key: "startDate", width: 15 },
    { header: "End Date", key: "endDate", width: 15 },
    { header: "Created At", key: "createdAt", width: 20 },
    { header: "Updated At", key: "updatedAt", width: 20 },
  ]);
  return workbook;
}

function buildTasksWorkbook(rows) {
  const workbook = createWorkbook();
  buildSheet(workbook, "Tasks", rows, [
    { header: "ID", key: "id", width: 10 },
    { header: "Goal ID", key: "goalId", width: 10 },
    { header: "Title", key: "title", width: 40 },
    { header: "Description", key: "description", width: 50 },
    { header: "Status", key: "status", width: 18 },
    { header: "Assignee ID", key: "assigneeId", width: 12 },
    { header: "Due Date", key: "dueDate", width: 15 },
    { header: "Progress", key: "progress", width: 12 },
    { header: "Weight", key: "weight", width: 10 },
    { header: "Created At", key: "createdAt", width: 20 },
    { header: "Updated At", key: "updatedAt", width: 20 },
  ]);
  return workbook;
}

function buildActivitiesWorkbook(rows) {
  const workbook = createWorkbook();
  buildSheet(workbook, "Activities", rows, [
    { header: "ID", key: "id", width: 10 },
    { header: "Task ID", key: "taskId", width: 10 },
    { header: "Title", key: "title", width: 40 },
    { header: "Description", key: "description", width: 50 },
    { header: "Status", key: "status", width: 18 },
    { header: "Due Date", key: "dueDate", width: 15 },
    { header: "Previous Metric", key: "previousMetric", width: 15 },
    { header: "Target Metric", key: "targetMetric", width: 15 },
    { header: "Current Metric", key: "currentMetric", width: 15 },
    { header: "Quarterly Goals", key: "quarterlyGoals", width: 15 },
    { header: "Progress", key: "progress", width: 12 },
    { header: "Weight", key: "weight", width: 10 },
    { header: "Is Done", key: "isDone", width: 10 },
    { header: "Created At", key: "createdAt", width: 20 },
    { header: "Updated At", key: "updatedAt", width: 20 },
  ]);
  return workbook;
}

function buildAnnualPlanWorkbook(goals, tasks, activities) {
  const workbook = createWorkbook();
  buildSheet(workbook, "Goals", goals, [
    { header: "ID", key: "id", width: 10 },
    { header: "Title", key: "title", width: 40 },
    { header: "Description", key: "description", width: 50 },
    { header: "Group ID", key: "groupId", width: 12 },
    { header: "Status", key: "status", width: 18 },
    { header: "Progress", key: "progress", width: 12 },
    { header: "Weight", key: "weight", width: 10 },
    { header: "Start Date", key: "startDate", width: 15 },
    { header: "End Date", key: "endDate", width: 15 },
  ]);
  buildSheet(workbook, "Tasks", tasks, [
    { header: "ID", key: "id", width: 10 },
    { header: "Goal ID", key: "goalId", width: 10 },
    { header: "Title", key: "title", width: 40 },
    { header: "Description", key: "description", width: 50 },
    { header: "Status", key: "status", width: 18 },
    { header: "Assignee ID", key: "assigneeId", width: 12 },
    { header: "Due Date", key: "dueDate", width: 15 },
    { header: "Progress", key: "progress", width: 12 },
    { header: "Weight", key: "weight", width: 10 },
  ]);
  buildSheet(workbook, "Activities", activities, [
    { header: "ID", key: "id", width: 10 },
    { header: "Task ID", key: "taskId", width: 10 },
    { header: "Title", key: "title", width: 40 },
    { header: "Description", key: "description", width: 50 },
    { header: "Status", key: "status", width: 18 },
    { header: "Due Date", key: "dueDate", width: 15 },
    { header: "Previous Metric", key: "previousMetric", width: 15 },
    { header: "Target Metric", key: "targetMetric", width: 15 },
    { header: "Current Metric", key: "currentMetric", width: 15 },
    { header: "Quarterly Goals", key: "quarterlyGoals", width: 15 },
    { header: "Progress", key: "progress", width: 12 },
    { header: "Weight", key: "weight", width: 10 },
    { header: "Is Done", key: "isDone", width: 10 },
  ]);

  return workbook;
}

function buildReportWorkbook(rows) {
  const workbook = createWorkbook();
  buildSheet(workbook, "Reports", rows, [
    { header: "ID", key: "id", width: 10 },
    { header: "Activity ID", key: "activityId", width: 10 },
    { header: "User ID", key: "userId", width: 10 },
    { header: "Narrative", key: "narrative", width: 50 },
    { header: "Metrics Data", key: "metrics_data", width: 40 },
    { header: "New Status", key: "new_status", width: 18 },
    { header: "Created At", key: "createdAt", width: 20 },
    { header: "Updated At", key: "updatedAt", width: 20 },
  ]);
  return workbook;
}

module.exports = {
  buildCsvFromRows,
  buildGoalsWorkbook,
  buildTasksWorkbook,
  buildActivitiesWorkbook,
  buildAnnualPlanWorkbook,
  buildReportWorkbook,
};
