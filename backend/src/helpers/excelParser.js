const ExcelJS = require("exceljs");

function normalizeHeader(header) {
  if (header === undefined || header === null) return "";
  return String(header)
    .trim()
    .toLowerCase()
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "_");
}

// Special marker for empty cells that are explicitly present in the workbook
const EXPLICIT_EMPTY = Symbol("__EXPLICIT_EMPTY__");

function parseCellValue(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    // Mark explicitly empty cells so we can distinguish from "not provided"
    if (trimmed === "") return EXPLICIT_EMPTY;
    return trimmed;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if (value.text !== undefined) return value.text;
    return value;
  }
  return String(value);
}

function parseWorksheet(worksheet) {
  if (!worksheet) return [];
  const headers = [];
  const rows = [];
  const firstRow = worksheet.getRow(1);
  firstRow.eachCell((cell, colNumber) => {
    headers[colNumber] = normalizeHeader(cell.value);
  });

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const rowObject = {};
    let hasValue = false;
    row.eachCell((cell, colNumber) => {
      const header = headers[colNumber];
      if (!header) return;
      const value = parseCellValue(cell.value);
      rowObject[header] = value;
      if (value !== null && value !== undefined && value !== "") {
        hasValue = true;
      }
    });
    if (hasValue) {
      rowObject.rowNumber = rowNumber;
      rows.push(rowObject);
    }
  });

  return rows;
}

function parseNumeric(value) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeString(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim().toLowerCase();
}

function getMetricKeyFromActivityRow(row) {
  const rawMetric =
    row.metric_key ||
    row.activity_target_metric ||
    row.target_metric ||
    row.activity_current_metric ||
    row.current_metric ||
    row.currentMetric ||
    null;

  if (rawMetric === null || rawMetric === undefined) return null;
  if (typeof rawMetric === "object") {
    const keys = Object.keys(rawMetric);
    return keys.length > 0 ? String(keys[0]).trim() : null;
  }

  const trimmed = String(rawMetric).trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object") {
      const keys = Object.keys(parsed);
      if (keys.length > 0) return String(keys[0]).trim();
    }
  } catch {
    // Not JSON, continue with raw string value.
  }

  return trimmed;
}

function buildQuarterRowsFromActivities(rows) {
  const currentYear = new Date().getFullYear();
  const quarterRows = [];

  function getQuarterValue(row, quarter, fields) {
    for (const field of fields) {
      const value = row[`q${quarter}_${field}`];
      if (
        value !== undefined &&
        value !== null &&
        String(value).trim() !== ""
      ) {
        return parseNumeric(value);
      }
    }
    return null;
  }

  function getQuarterRemark(row, quarter) {
    const value =
      row[`q${quarter}_remark`] ??
      row[`q${quarter}_remarks`] ??
      row[`q${quarter}_note`] ??
      row[`q${quarter}_notes`];
    if (value === undefined || value === null) return null;
    const normalized = String(value).trim();
    return normalized === "" ? null : normalized;
  }

  for (const row of Array.isArray(rows) ? rows : []) {
    const metricKey = getMetricKeyFromActivityRow(row) || "quarterlyGoals";
    for (let quarter = 1; quarter <= 4; quarter += 1) {
      const planned = getQuarterValue(row, quarter, ["goal", "planned"]);
      const actual = getQuarterValue(row, quarter, ["record", "actual"]);
      const remark = getQuarterRemark(row, quarter);
      if (planned === null && actual === null && remark === null) continue;
      quarterRows.push({
        ...row,
        quarter,
        fiscal_year: Number(row.fiscal_year || currentYear) || currentYear,
        metric_key: metricKey,
        planned,
        actual,
        remark,
        sheetName: "Activities",
      });
    }
  }
  return quarterRows;
}

function mergeQuarterRows(activityRows, sheetRows) {
  const merged = [];
  const seen = new Set();

  function rowKey(row) {
    return [
      row.activity_id || "",
      row.activity_roll_no || "",
      row.activity_title || "",
      row.activity_name || "",
      row.quarter || "",
      String(row.metric_key || "")
        .trim()
        .toLowerCase(),
    ].join("|");
  }

  for (const row of Array.isArray(activityRows) ? activityRows : []) {
    merged.push(row);
    seen.add(rowKey(row));
  }

  for (const row of Array.isArray(sheetRows) ? sheetRows : []) {
    const key = rowKey(row);
    if (!seen.has(key)) {
      merged.push(row);
      seen.add(key);
    }
  }

  return merged;
}

function getSheetByName(workbook, name) {
  const sheet = workbook.getWorksheet(name);
  if (sheet) return sheet;
  const lowerName = name.toLowerCase();
  return workbook.worksheets.find((ws) => ws.name.toLowerCase() === lowerName);
}

function parseQuarterRows(worksheet, quarter) {
  if (!worksheet) return [];
  const rows = parseWorksheet(worksheet);
  return rows.map((row) => ({
    ...row,
    quarter,
    sheetName: worksheet.name,
  }));
}

async function parseWorkbook(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const goals = parseWorksheet(getSheetByName(workbook, "Goals"));
  const tasks = parseWorksheet(getSheetByName(workbook, "Tasks"));
  const activities = parseWorksheet(getSheetByName(workbook, "Activities"));
  const sheetQuarterRows = [
    ...parseQuarterRows(getSheetByName(workbook, "Quarter1"), 1),
    ...parseQuarterRows(getSheetByName(workbook, "Quarter2"), 2),
    ...parseQuarterRows(getSheetByName(workbook, "Quarter3"), 3),
    ...parseQuarterRows(getSheetByName(workbook, "Quarter4"), 4),
  ];
  const activityQuarterRows = buildQuarterRowsFromActivities(activities);
  const quarters = mergeQuarterRows(activityQuarterRows, sheetQuarterRows);

  return {
    goals,
    tasks,
    activities,
    quarters,
  };
}

module.exports = {
  parseWorkbook,
  parseWorksheet,
  normalizeHeader,
  getMetricKeyFromActivityRow,
  buildQuarterRowsFromActivities,
  EXPLICIT_EMPTY,
};
