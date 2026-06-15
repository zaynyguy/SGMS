function normalize(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim().toLowerCase();
}

function buildDedupKey(rows, type) {
  switch (type) {
    case "goal": {
      const roll = rows.goal_roll_no || rows.rollno;
      if (roll) return `rollno:${String(roll).trim()}`;
      return `title:${normalize(rows.goal_title || rows.goal_name || rows.title || rows.name)}|group:${normalize(rows.goal_group_name || rows.goal_group_id)}`;
    }
    case "task": {
      const goalKey = rows.goal_id ? `goalId:${String(rows.goal_id).trim()}` : rows.goal_roll_no ? `goalRoll:${String(rows.goal_roll_no).trim()}` : `goalTitle:${normalize(rows.goal_title || rows.goal_name)}`;
      if (rows.task_roll_no) return `${goalKey}|rollno:${String(rows.task_roll_no).trim()}`;
      return `${goalKey}|title:${normalize(rows.task_title || rows.task_name || rows.title || rows.name)}`;
    }
    case "activity": {
      const taskKey = rows.task_id ? `taskId:${String(rows.task_id).trim()}` : rows.task_roll_no ? `taskRoll:${String(rows.task_roll_no).trim()}` : `taskTitle:${normalize(rows.task_title || rows.task_name)}`;
      if (rows.activity_roll_no) return `${taskKey}|rollno:${String(rows.activity_roll_no).trim()}`;
      return `${taskKey}|title:${normalize(rows.activity_title || rows.activity_name || rows.title || rows.name)}`;
    }
    default:
      return null;
  }
}

function dedupeRows(rows, type, warnings) {
  const seen = new Map();
  const result = [];
  for (const row of rows) {
    const key = buildDedupKey(row, type);
    if (!key) {
      result.push(row);
      continue;
    }
    if (seen.has(key)) {
      warnings.push({ sheet: type === "goal" ? "Goals" : type === "task" ? "Tasks" : "Activities", row: row.rowNumber || null, message: `Duplicate ${type} entry removed based on roll number/title match.` });
      continue;
    }
    seen.set(key, row);
    result.push(row);
  }
  return result;
}

function cleanImportData(parsed) {
  const warnings = [];
  const cleaned = {
    goals: dedupeRows(parsed.goals || [], "goal", warnings),
    tasks: dedupeRows(parsed.tasks || [], "task", warnings),
    activities: dedupeRows(parsed.activities || [], "activity", warnings),
    quarters: Array.isArray(parsed.quarters) ? parsed.quarters : [],
  };
  return { parsed: cleaned, warnings };
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

    for (let q = 1; q <= 4; q += 1) {
      const goalValue = row[`q${q}_goal`];
      const recordValue = row[`q${q}_record`];
      if (goalValue !== undefined && goalValue !== null && String(goalValue).trim() !== "") {
        const parsedGoal = Number(goalValue);
        if (!Number.isFinite(parsedGoal)) {
          errors.push({ sheet: "Activities", row: rowNumber, message: `Q${q} Goal must be a number or empty.` });
        }
      }
      if (recordValue !== undefined && recordValue !== null && String(recordValue).trim() !== "") {
        const parsedRecord = Number(recordValue);
        if (!Number.isFinite(parsedRecord)) {
          errors.push({ sheet: "Activities", row: rowNumber, message: `Q${q} Record must be a number or empty.` });
        }
      }
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
  cleanImportData,
};
