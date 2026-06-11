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

function parseCellValue(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return null;
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

function getSheetByName(workbook, name) {
  const sheet = workbook.getWorksheet(name);
  if (sheet) return sheet;
  const lowerName = name.toLowerCase();
  return workbook.worksheets.find(
    (ws) => ws.name.toLowerCase() === lowerName,
  );
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
  const quarter1 = parseQuarterRows(getSheetByName(workbook, "Quarter1"), 1);
  const quarter2 = parseQuarterRows(getSheetByName(workbook, "Quarter2"), 2);
  const quarter3 = parseQuarterRows(getSheetByName(workbook, "Quarter3"), 3);
  const quarter4 = parseQuarterRows(getSheetByName(workbook, "Quarter4"), 4);

  return {
    goals,
    tasks,
    activities,
    quarters: [...quarter1, ...quarter2, ...quarter3, ...quarter4],
  };
}

module.exports = {
  parseWorkbook,
  parseWorksheet,
  normalizeHeader,
};
