# SGMS System Issues and Fixes

## Critical Issues

### 1. Progress Calculation Not Working When Activity Status Changes
**Problem**: When updating an activity's `isDone` field to `true` via the UI, the task progress doesn't update automatically.

**Root Cause**: The triggers are firing, but the progress calculation uses a weighted average approach that doesn't handle the `isDone` completion override correctly when activities don't have metrics.

**Solution**: Modify the activity update endpoint to explicitly recalculate progress through `accumulate_metrics` function when `isDone` changes.

---

### 2. Import System Only Updates Master Report, Not Database
**Problem**: The bulk import feature should directly update Goals, Tasks, and Activities in the database to reflect work done, but currently:
- It only updates when currentMetric is provided
- It doesn't handle status updates correctly
- It doesn't recalculate progress for updated activities

**Root Cause**: The import flow updates existing records but doesn't call `accumulate_metrics` for status/isDone changes, only for metric updates.

**Solution**: Ensure `accumulate_metrics` is called for ALL activity updates during import, not just when metrics change.

---

## Implementation Details

### Fix 1: Update Activity Status Change Flow

**File**: `backend/src/controllers/activitiesController.js`

When `isDone` is updated:
1. Update the activity record with new isDone value
2. Immediately call `accumulate_metrics` to recalculate progress
3. This will cascade progress updates to task and goal

**Code Pattern**:
```javascript
// After updating activity with isDone
if (safeIsDone !== null) {
  const metricForProgress = updatedActivity.currentMetric || {};
  await client.query(
    'SELECT accumulate_metrics($1::int, $2::jsonb, $3::int, NULL)',
    [activityId, metricForProgress, req.user.id]
  );
}
```

---

### Fix 2: Enhance Import to Handle All Update Scenarios

**File**: `backend/src/controllers/reportsController.js` - `bulkImportActivitiesExcel` function

When updating existing activities:
1. Call `accumulate_metrics` for ANY activity update, not just metric changes
2. Include both metric updates AND status/isDone changes
3. This ensures progress rolls up correctly

**Code Pattern**:
```javascript
// After updating existing activity
const metricToUse = currentMetricJson || updatedActivity.currentMetric || {};
await client.query(
  'SELECT accumulate_metrics($1::int, $2::jsonb, $3::int, NULL)',
  [activityId, metricToUse, req.user.id]
);
```

---

### Fix 3: Ensure Database Triggers Are Properly Set Up

**Migration**: Verify that `004_fix_progress_rollup_triggers.sql` creates triggers that:
1. Fire on ANY INSERT/UPDATE/DELETE of Activities
2. Recalculate task progress using weighted average
3. Recalculate goal progress from task progress
4. Handle the isDone completion override properly

---

## User Permission Model

### Admin Capabilities (vs Report System)
- **Admin**: Can directly update activity status, isDone, and metrics through UI
- **Users**: Should use report system to submit progress data
- **System**: Must distinguish between admin edits and user submissions
- **Progress**: Admin changes should update database immediately; user changes tracked via reports

---

## Import System Architecture

### Current Flow (Broken)
1. User downloads template from Master Report
2. User edits Goals/Tasks/Activities in Excel
3. User uploads Excel file
4. System imports but only updates if:
   - currentMetric is provided
   - Goals/Tasks don't already exist

### Expected Flow (After Fix)
1. User downloads template from Master Report page
2. User can edit:
   - Activity status (To Do → In Progress → Complete)
   - isDone flag (for completion)
   - Metrics (currentMetric values)
   - Task/Goal status and weights
3. User uploads Excel file
4. System:
   - Updates all Goals/Tasks/Activities in database
   - Calls accumulate_metrics for each activity
   - Recalculates progress cascade (Activity → Task → Goal)
   - Returns summary of changes

---

## Progress Calculation Logic

### Activity Level
- If `isDone = true`: Progress = 100%
- Otherwise: Calculate based on metricType:
  - **Plus**: `progress = (sum(currentMetric) / sum(targetMetric)) * 100`
  - **Minus**: `progress = (|sum(currentMetric)| / |sum(targetMetric)|) * 100`
  - **Increase**: `progress = ((current - previous) / target) * 100`
  - **Decrease**: `progress = ((previous - current) / target) * 100`
  - **Maintain**: `progress = 100%` (if current matches target)

### Task Level (Cascade from Activities)
- `taskProgress = SUM(activity.progress * activity.weight) / SUM(activity.weight)`

### Goal Level (Cascade from Tasks)
- `goalProgress = SUM(task.progress * task.weight) / SUM(task.weight)`

---

## Testing Checklist

- [ ] Verify migrations have run: `npm run migrate`
- [ ] Update activity isDone=true via API → Task progress updates
- [ ] Update activity isDone=false via API → Task progress recalculates
- [ ] Import Excel with status changes → Database reflects changes
- [ ] Import Excel with metric changes → Progress cascades correctly
- [ ] Progress shows 100% when isDone=true, regardless of metrics
- [ ] Progress correctly weighted by activity/task weight

---

## Files to Modify

1. **backend/src/controllers/activitiesController.js**
   - Update `updateActivity` function to call `accumulate_metrics` when isDone changes

2. **backend/src/controllers/reportsController.js**
   - Enhance `bulkImportActivitiesExcel` to call `accumulate_metrics` for all updates

3. **Migrations**
   - Verify `004_fix_progress_rollup_triggers.sql` is applied
   - Consider adding migration for trigger verification/repair

---

## Next Steps

1. Apply the fixes in the order listed
2. Test each fix individually
3. Run full test suite
4. Update frontend to show bulk import page under Project Management section
