// src/utils/projectUtils.js
export function formatDate(d, t) {
  if (!d) return t ? t("project.na") : "N/A";
  try {
    const parsed = new Date(d);
    if (isNaN(parsed)) return d;
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(parsed);
  } catch {
    return d;
  }
}

export function metricsObjectToArray(tm) {
  try {
    if (!tm) return [{ key: "", value: "" }];
    let obj = tm;
    if (typeof tm === "string") obj = tm.trim() === "" ? {} : JSON.parse(tm);
    if (typeof obj !== "object" || Array.isArray(obj))
      return [{ key: "", value: "" }];
    const arr = Object.keys(obj).map((k) => ({ key: k, value: String(obj[k]) }));
    return arr.length ? arr : [{ key: "", value: "" }];
  } catch {
    return [{ key: "", value: "" }];
  }
}

export function computeGoalWeightAvailable(goals, tasks, goalId, excludeTaskId = null) {
  const g = (goals || []).find((x) => String(x.id) === String(goalId) || x.id === goalId);
  const goalWeight = Number(g?.weight ?? 100);
  const list = (tasks?.[goalId]) || [];
  const sumOther = list.reduce((s, t) => {
    if (excludeTaskId && String(t.id) === String(excludeTaskId)) return s;
    return s + Number(t.weight || 0);
  }, 0);
  return { goalWeight, used: sumOther, available: Math.max(0, goalWeight - sumOther) };
}

export function computeTaskWeightAvailable(tasksObj, activities, taskId, excludeActivityId = null) {
  const allTasksLists = Object.values(tasksObj || {}).flat();
  const task = allTasksLists.find((t) => String(t.id) === String(taskId) || t.id === taskId);
  const taskWeight = Number(task?.weight ?? 0);
  const list = (activities?.[taskId]) || [];
  const sumOther = list.reduce((s, a) => {
    if (excludeActivityId && String(a.id) === String(excludeActivityId)) return s;
    return s + Number(a.weight || 0);
  }, 0);
  return { taskWeight, used: sumOther, available: Math.max(0, taskWeight - sumOther) };
}
