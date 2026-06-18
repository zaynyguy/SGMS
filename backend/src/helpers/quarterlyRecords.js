const QUARTER_KEYS = ["q1", "q2", "q3", "q4"];

function normalizeMetricKey(metricKey) {
  if (metricKey === null || metricKey === undefined) return "";
  return String(metricKey).trim().toLowerCase();
}

function parseJsonIfString(value) {
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

function getPrimaryMetricKey(activity) {
  if (!activity || typeof activity !== "object") return "value";
  const rawTargetMetric = activity.targetMetric || activity.target_metric || {};
  const targetMetric = parseJsonIfString(rawTargetMetric);
  if (targetMetric && typeof targetMetric === "object") {
    const keys = Object.keys(targetMetric);
    if (keys.length > 0) {
      return normalizeMetricKey(keys[0]);
    }
  }
  return "value";
}

function getRecordValue(record) {
  if (!record || typeof record !== "object") return record;
  return record.value;
}

function selectQuarterlyRecordValue(
  records,
  primaryMetricKey,
  defaultValue = "",
) {
  if (!Array.isArray(records) || records.length === 0) return defaultValue;

  const normalizedPrimaryKey = normalizeMetricKey(primaryMetricKey);
  const normalizedRecords = records.map((rec) => ({
    ...rec,
    metricKey: normalizeMetricKey(rec.metricKey),
  }));

  const exact = normalizedRecords.find(
    (rec) => rec.metricKey === normalizedPrimaryKey,
  );
  if (exact && exact.value !== null && exact.value !== undefined) {
    return exact.value;
  }

  const primaryActual = normalizedRecords.find(
    (rec) => rec.metricKey === `${normalizedPrimaryKey}_actual`,
  );
  if (
    primaryActual &&
    primaryActual.value !== null &&
    primaryActual.value !== undefined
  ) {
    return primaryActual.value;
  }

  const aliasActual = normalizedRecords.find((rec) =>
    /^(quarterlygoals|q[1-4])_actual$/.test(rec.metricKey),
  );
  if (
    aliasActual &&
    aliasActual.value !== null &&
    aliasActual.value !== undefined
  ) {
    return aliasActual.value;
  }

  // Do not fall back to alias or planned metric records.
  // Only authoritative actual values should be used for quarterlyRecords.
  return defaultValue;
}

function buildQuarterlyRecordsMap(activityRows, recordRows, defaultValue = "") {
  console.log(
    "[DEBUG buildQuarterlyRecordsMap] Called with",
    Array.isArray(activityRows) ? activityRows.length : 0,
    "activities and",
    Array.isArray(recordRows) ? recordRows.length : 0,
    "records",
  );
  const activityMap = {};
  const buckets = {};

  for (const rec of Array.isArray(recordRows) ? recordRows : []) {
    const activityId = rec.activityId ?? rec.activity_id;
    const quarter = Number(rec.quarter);
    if (
      !activityId ||
      !Number.isInteger(quarter) ||
      quarter < 1 ||
      quarter > 4
    ) {
      continue;
    }

    const qKey = `q${quarter}`;
    if (!buckets[activityId]) buckets[activityId] = {};
    if (!buckets[activityId][qKey]) buckets[activityId][qKey] = [];
    buckets[activityId][qKey].push(rec);
  }

  console.log(
    "[DEBUG buildQuarterlyRecordsMap] Created buckets for",
    Object.keys(buckets).length,
    "activities",
  );

  for (const activity of Array.isArray(activityRows) ? activityRows : []) {
    const activityId = activity.id ?? activity.activity_id;
    const primaryMetricKey = getPrimaryMetricKey(activity);
    const rows = buckets[activityId] || {};
    const mapped = {
      q1: selectQuarterlyRecordValue(
        rows.q1 || [],
        primaryMetricKey,
        defaultValue,
      ),
      q2: selectQuarterlyRecordValue(
        rows.q2 || [],
        primaryMetricKey,
        defaultValue,
      ),
      q3: selectQuarterlyRecordValue(
        rows.q3 || [],
        primaryMetricKey,
        defaultValue,
      ),
      q4: selectQuarterlyRecordValue(
        rows.q4 || [],
        primaryMetricKey,
        defaultValue,
      ),
    };
    activityMap[activityId] = mapped;
    if (mapped.q1 || mapped.q2 || mapped.q3 || mapped.q4) {
      console.log(
        "[DEBUG buildQuarterlyRecordsMap] Activity",
        activityId,
        "- primaryMetricKey:",
        primaryMetricKey,
        "- mapped:",
        mapped,
      );
    }
  }

  return activityMap;
}

module.exports = {
  QUARTER_KEYS,
  normalizeMetricKey,
  getPrimaryMetricKey,
  buildQuarterlyRecordsMap,
};
