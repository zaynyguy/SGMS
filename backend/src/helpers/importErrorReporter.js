const ExcelJS = require("exceljs");

function buildErrorCsv(errors) {
  const header = ["Sheet", "Row", "Type", "Message"];
  const lines = [header.join(",")];
  for (const error of errors) {
    const row = [
      JSON.stringify(error.sheet || ""),
      JSON.stringify(error.row || ""),
      JSON.stringify(error.type || ""),
      JSON.stringify(error.message || ""),
    ];
    lines.push(row.join(","));
  }
  return lines.join("\n");
}

function buildErrorWorkbook(errors) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Import Errors");
  worksheet.columns = [
    { header: "Sheet", key: "sheet", width: 20 },
    { header: "Row", key: "row", width: 10 },
    { header: "Type", key: "type", width: 15 },
    { header: "Message", key: "message", width: 80 },
  ];
  errors.forEach((error) => {
    worksheet.addRow({
      sheet: error.sheet || "",
      row: error.row || "",
      type: error.type || "",
      message: error.message || "",
    });
  });
  return workbook;
}

module.exports = {
  buildErrorCsv,
  buildErrorWorkbook,
};
