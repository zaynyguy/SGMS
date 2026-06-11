function normalize(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim().toLowerCase();
}

function buildIdentifier(row, keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== "") {
      return String(row[key]).trim();
    }
  }
  return null;
}

function validateImportData(parsed) {
  const errors = [];
  const warnings = [];

  if (!parsed.goals.length) {
    errors.push({ sheet: "Goals", message: "Goals sheet is empty or missing." });
  }
  if (!parsed.tasks.length) {
    errors.push({ sheet: "Tasks", message: "Tasks sheet is empty or missing." });
  }
  if (!parsed.activities.length) {
    errors.push({ sheet: "Activities", message: "Activities sheet is empty or missing." });
  }

  const knownGoalIdentifiers = new Map();
  const knownTaskIdentifiers = new Map();
  const knownActivityIdentifiers = new Map();

  parsed.goals.forEach((row, index) => {
    const rowNumber = row.rowNumber || index + 2;
    const title = buildIdentifier(row, ["goal_title", "goal_name", "title", "name"]);
    const code = buildIdentifier(row, ["goal_code", "code", "rollno"]);
    if (!title && !code) {
      errors.push({ sheet: "Goals", row: rowNumber, message: "Goal must include a title or code." });
    }
    const identifier = code || title;
    if (identifier) {
      const key = `${normalize(identifier)}|${normalize(buildIdentifier(row, ["goal_group_name", "group_name"]))}`;
      if (knownGoalIdentifiers.has(key)) {
        warnings.push({ sheet: "Goals", row: rowNumber, message: "Duplicate Goal entry detected." });
      } else {
        knownGoalIdentifiers.set(key, true);
      }
    }
  });

  parsed.tasks.forEach((row, index) => {
    const rowNumber = row.rowNumber || index + 2;
    const title = buildIdentifier(row, ["task_title", "task_name", "title", "name"]);
    const code = buildIdentifier(row, ["task_code", "code", "rollno"]);
    const goalIdentifier = buildIdentifier(row, ["goal_code", "goal_id", "goal_roll_no", "goal_title", "goal_name", "rollno"]);
    if (!title) {
      errors.push({ sheet: "Tasks", row: rowNumber, message: "Task must include a title." });
    }
    if (!goalIdentifier) {
      errors.push({ sheet: "Tasks", row: rowNumber, message: "Task must reference a Goal by title, id, or code." });
    }
    const identifier = `${code || title}|${normalize(goalIdentifier)}`;
    if (knownTaskIdentifiers.has(identifier)) {
      warnings.push({ sheet: "Tasks", row: rowNumber, message: "Duplicate Task entry detected." });
    } else {
      knownTaskIdentifiers.set(identifier, true);
    }
  });

  parsed.activities.forEach((row, index) => {
    const rowNumber = row.rowNumber || index + 2;
    const title = buildIdentifier(row, ["activity_title", "activity_name", "title", "name"]);
    const code = buildIdentifier(row, ["activity_code", "code", "rollno"]);
    const taskIdentifier = buildIdentifier(row, ["task_code", "task_id", "task_title", "task_name", "task_roll_no", "rollno"]);
    if (!title) {
      errors.push({ sheet: "Activities", row: rowNumber, message: "Activity must include a title." });
    }
    if (!taskIdentifier) {
      errors.push({ sheet: "Activities", row: rowNumber, message: "Activity must reference a Task by title, id, code, or roll number." });
    }
    const identifier = `${code || title}|${normalize(taskIdentifier)}`;
    if (knownActivityIdentifiers.has(identifier)) {
      warnings.push({ sheet: "Activities", row: rowNumber, message: "Duplicate Activity entry detected." });
    } else {
      knownActivityIdentifiers.set(identifier, true);
    }
  });

  parsed.quarters.forEach((row, index) => {
    const rowNumber = row.rowNumber || index + 2;
    const activityIdentifier = buildIdentifier(row, ["activity_code", "activity_id", "activity_roll_no", "activity_title", "activity_name", "code"]);
    if (!activityIdentifier) {
      errors.push({ sheet: row.sheetName || `Quarter${row.quarter}`, row: rowNumber, message: "Quarter update must reference an Activity by id, roll number, title, or code." });
    }
    if (row.quarter < 1 || row.quarter > 4) {
      warnings.push({ sheet: row.sheetName || `Quarter${row.quarter}`, row: rowNumber, message: "Quarter number should be between 1 and 4." });
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    counts: {
      goals: parsed.goals.length,
      tasks: parsed.tasks.length,
      activities: parsed.activities.length,
      quarters: parsed.quarters.length,
    },
  };
}

module.exports = {
  validateImportData,
};
