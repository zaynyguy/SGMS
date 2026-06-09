const ExcelJS = require("exceljs");

// ===== UTILITIES =====

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

// ===== EXPORT: Hierarchical Master Workbook =====

function buildMasterWorkbook(masterJson) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SGMS";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Master Report");

  // Define header style
  const headerStyle = {
    font: { bold: true, color: { argb: "FFFFFFFF" } },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: {
      top: { style: "thin", color: { argb: "FF000000" } },
      left: { style: "thin", color: { argb: "FF000000" } },
      bottom: { style: "thin", color: { argb: "FF000000" } },
      right: { style: "thin", color: { argb: "FF000000" } },
    },
  };

  const hierarchyHeaderStyle = {
    font: { bold: true, color: { argb: "FF000000" } },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFE7E6E6" } },
    alignment: { horizontal: "left", vertical: "center" },
    border: {
      top: { style: "thin", color: { argb: "FF000000" } },
      left: { style: "thin", color: { argb: "FF000000" } },
      bottom: { style: "thin", color: { argb: "FF000000" } },
      right: { style: "thin", color: { argb: "FF000000" } },
    },
  };

  const normalStyle = {
    alignment: { horizontal: "left", vertical: "center", wrapText: true },
    border: {
      top: { style: "thin", color: { argb: "FFD3D3D3" } },
      left: { style: "thin", color: { argb: "FFD3D3D3" } },
      bottom: { style: "thin", color: { argb: "FFD3D3D3" } },
      right: { style: "thin", color: { argb: "FFD3D3D3" } },
    },
  };

  // Set up columns
  sheet.columns = [
    { header: "Level", key: "level", width: 15 },
    { header: "Title", key: "title", width: 40 },
    { header: "Metric Type", key: "metricType", width: 15 },
    { header: "Target", key: "target", width: 15 },
    { header: "Current", key: "current", width: 15 },
    { header: "Previous", key: "previous", width: 15 },
    { header: "Progress %", key: "progress", width: 12 },
    { header: "Status", key: "status", width: 15 },
    { header: "Weight", key: "weight", width: 10 },
    { header: "Due Date", key: "dueDate", width: 15 },
    { header: "Notes", key: "notes", width: 30 },
  ];

  // Add header row
  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell) => {
    Object.assign(cell, headerStyle);
  });

  let rowNum = 2;

  // Process each goal
  for (const goal of masterJson.goals || []) {
    // Goal row
    const goalRow = sheet.getRow(rowNum);
    goalRow.values = {
      level: "GOAL",
      title: goal.title,
      metricType: "",
      target: "",
      current: "",
      previous: "",
      progress: goal.progress,
      status: goal.status,
      weight: goal.weight,
      dueDate: "",
      notes: goal.description || "",
    };
    // Apply goal styling
    goalRow.eachCell((cell) => {
      Object.assign(cell, hierarchyHeaderStyle);
    });
    rowNum++;

    // Process tasks in goal
    for (const task of goal.tasks || []) {
      const taskRow = sheet.getRow(rowNum);
      taskRow.values = {
        level: "  TASK",
        title: task.title,
        metricType: "",
        target: "",
        current: "",
        previous: "",
        progress: task.progress,
        status: task.status,
        weight: task.weight,
        dueDate: task.dueDate || "",
        notes: task.description || "",
      };
      // Apply task styling (slightly indented)
      taskRow.eachCell((cell) => {
        Object.assign(cell, hierarchyHeaderStyle);
      });
      rowNum++;

      // Process activities in task
      for (const activity of task.activities || []) {
        const actRow = sheet.getRow(rowNum);

        const targetVal = activity.targetMetric
          ? Object.values(activity.targetMetric)[0]
          : "";
        const currentVal = activity.currentMetric
          ? Object.values(activity.currentMetric)[0]
          : "";
        const previousVal = activity.previousMetric
          ? Object.values(activity.previousMetric)[0]
          : "";

        actRow.values = {
          level: "    ACTIVITY",
          title: activity.title,
          metricType: activity.metricType || "Plus",
          target: targetVal,
          current: currentVal,
          previous: previousVal,
          progress: activity.progress,
          status: activity.status,
          weight: activity.weight,
          dueDate: activity.dueDate || "",
          notes: activity.description || "",
        };
        // Apply activity styling (further indented)
        actRow.eachCell((cell) => {
          Object.assign(cell, normalStyle);
        });
        rowNum++;
      }
    }
  }

  // Freeze first row
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  return workbook;
}

// ===== IMPORT: Parse hierarchical workbook with deduplication =====

async function parseExcelWorkbook(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  // Check for "Master Report" sheet (new hierarchical format)
  const masterSheet = getSheetByName(workbook, "Master Report");
  if (masterSheet) {
    return parseHierarchicalSheet(masterSheet);
  }

  // Fall back to legacy flat format
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

/**
 * Parse hierarchical Master Report sheet and return structured data
 * Also deduplicate by (title, rollNo) composite key
 */
function parseHierarchicalSheet(worksheet) {
  const goals = [];
  const goalMap = new Map(); // Key: goalTitle, Value: goal object
  let currentGoal = null;
  let currentTask = null;

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header

    const level = row.getCell(1).value;
    if (!level) return; // Skip empty rows

    const levelStr = String(level).trim().toUpperCase();
    const title = row.getCell(2).value;
    if (!title) return;

    if (levelStr === "GOAL") {
      // Create new goal
      const goalKey = String(title).trim().toLowerCase();
      if (!goalMap.has(goalKey)) {
        currentGoal = {
          title: String(title).trim(),
          description: row.getCell(11).value || "",
          status: row.getCell(8).value || "Not Started",
          weight: parseFloat(row.getCell(9).value) || 100,
          tasks: [],
        };
        goalMap.set(goalKey, currentGoal);
        goals.push(currentGoal);
      } else {
        currentGoal = goalMap.get(goalKey);
      }
      currentTask = null;
    } else if (levelStr.includes("TASK")) {
      // Create new task in current goal
      if (!currentGoal) return;

      const taskKey = String(title).trim().toLowerCase();
      let existingTask = currentGoal.tasks.find(
        (t) => String(t.title).trim().toLowerCase() === taskKey,
      );

      if (!existingTask) {
        existingTask = {
          title: String(title).trim(),
          description: row.getCell(11).value || "",
          status: row.getCell(8).value || "To Do",
          weight: parseFloat(row.getCell(9).value) || 0,
          dueDate: row.getCell(10).value || null,
          activities: [],
        };
        currentGoal.tasks.push(existingTask);
      }
      currentTask = existingTask;
    } else if (levelStr.includes("ACTIVITY")) {
      // Create new activity in current task
      if (!currentTask) return;

      const actKey = String(title).trim().toLowerCase();
      let existingAct = currentTask.activities.find(
        (a) => String(a.title).trim().toLowerCase() === actKey,
      );

      if (!existingAct) {
        existingAct = {
          title: String(title).trim(),
          description: row.getCell(11).value || "",
          metricType: row.getCell(3).value || "Plus",
          targetMetric: parseMetricCell(row.getCell(4).value),
          currentMetric: parseMetricCell(row.getCell(5).value),
          previousMetric: parseMetricCell(row.getCell(6).value),
          status: row.getCell(8).value || "To Do",
          weight: parseFloat(row.getCell(9).value) || 0,
          dueDate: row.getCell(10).value || null,
          isDone: false,
        };
        currentTask.activities.push(existingAct);
      }
    }
  });

  return {
    goals,
    tasks: [], // Not used in hierarchical format
    activities: [], // Not used in hierarchical format
    reports: [],
  };
}

/**
 * Parse metric cell value (could be number, JSON string, or formula)
 */
function parseMetricCell(value) {
  if (!value) return {};

  if (typeof value === "number") {
    return { value: value };
  }

  const str = String(value).trim();
  if (str === "" || str === "0") return {};

  // Try to parse as JSON
  if (str.startsWith("{") || str.startsWith("[")) {
    try {
      return JSON.parse(str);
    } catch (e) {
      // Not JSON, treat as single value
      const num = parseFloat(str);
      return isNaN(num) ? {} : { value: num };
    }
  }

  // Try as number
  const num = parseFloat(str);
  return isNaN(num) ? {} : { value: num };
}

module.exports = {
  buildMasterWorkbook,
  parseExcelWorkbook,
};
