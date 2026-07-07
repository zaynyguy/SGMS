# SGMS Enhancement Testing Guide

## Overview

This document outlines comprehensive testing procedures for the three-part SGMS enhancement:

1. **Part 1**: Security & Input Validation (XSS Prevention)
2. **Part 2**: Progress Calculation Logic (5 Metric Types + Completion Override)
3. **Part 3**: Excel System Redesign (Hierarchical Export/Import)

---

## Part 1: Security & Input Validation Testing

### 1.1 XSS Prevention - Payload Injection Tests

#### Test Case 1.1.1: HTML Escape in Form Input

**Objective**: Verify that HTML special characters are escaped in activity title/description
**Steps**:

1. Create a new activity with title: `<script>alert('XSS')</script>`
2. Save the activity
3. Reload the page
4. Verify the title displays as literal text, not executing JS

**Expected Result**: Title displays as `&lt;script&gt;alert('XSS')&lt;/script&gt;` or similar escaped form

#### Test Case 1.1.2: JSON Property Injection

**Objective**: Verify sanitization of JSON metric fields
**Steps**:

1. Create activity with targetMetric: `{"value": "<img src=x onerror='alert(1)'>"}`
2. Save and view in master report
3. Inspect browser console

**Expected Result**: No JavaScript execution; content rendered as text

#### Test Case 1.1.3: SQL Injection Prevention

**Objective**: Verify parameterized queries prevent SQL injection
**Steps**:

1. Create activity with title: `'; DROP TABLE "Activities"; --`
2. Save activity
3. Verify Activities table still exists and contains the activity

**Expected Result**: Activity saved with literal title; no table deletion

#### Test Case 1.1.4: CSV Export XSS Escape

**Objective**: Verify CSV doesn't embed executable content
**Steps**:

1. Create activity with title: `=cmd|' /C calc'!A1`
2. Export as template (Excel)
3. Open Excel file and check for formula warnings
4. Import back and verify safe

**Expected Result**: Formula prefix escaped or removed; no execution

### 1.2 Strict Input Validation Tests

#### Test Case 1.2.1: Unknown Properties Rejection

**Objective**: Verify that unknown JSON properties are rejected
**Steps**:

1. Send POST to `/api/activities/{taskId}` with payload:
   ```json
   {
     "title": "Test",
     "weight": 5,
     "unknownField": "should be rejected"
   }
   ```
2. Check response

**Expected Result**: 400 Bad Request with message about unknown field

#### Test Case 1.2.2: Metric Type Enum Validation

**Objective**: Verify only valid metric types accepted
**Steps**:

1. Create activity with `metricType: "InvalidType"`
2. Attempt to save
3. Check validation error

**Expected Result**: 400 Bad Request; validation error specifies allowed types

#### Test Case 1.2.3: Numeric Field Type Checking

**Objective**: Verify weight and progress must be numbers
**Steps**:

1. Create activity with `weight: "not a number"`
2. Attempt to save

**Expected Result**: 400 Bad Request; type validation error

---

## Part 2: Progress Calculation Logic Testing

### 2.1 Plus Metric Type Tests

#### Test Case 2.1.1: Cumulative Sum Calculation

**Objective**: Verify Plus metrics accumulate across quarters
**Setup**:

- Create activity with `metricType: "Plus"`
- Set `targetMetric: {"value": 1000}`
- Set quarterly records: Q1=100, Q2=200, Q3=150, Q4=null

**Steps**:

1. Submit report for Q1 with metric value 100
2. Submit report for Q2 with metric value 200
3. Submit report for Q3 with metric value 150
4. Check activity progress

**Expected Result**:

- Q1: currentMetric = 100, progress = 10% (100/1000)
- Q2: currentMetric = 300, progress = 30% (300/1000)
- Q3: currentMetric = 450, progress = 45% (450/1000)

#### Test Case 2.1.2: Target Not Met

**Objective**: Verify progress capped at actual performance
**Steps**:

1. Set target = 1000, quarters totaled to 600
2. Check progress percentage

**Expected Result**: Progress = 60% (600/1000 \* 100)

---

### 2.2 Minus Metric Type Tests

#### Test Case 2.2.1: Reduction Tracking

**Objective**: Verify Minus tracks cumulative reductions
**Setup**:

- `metricType: "Minus"`
- `targetMetric: {"value": 50}` (reduce by 50)
- `previousMetric: {"value": 200}` (starting point)
- Quarterly: Q1=-10, Q2=-15, Q3=-20

**Steps**:

1. Submit reports with negative values
2. Check currentMetric and progress

**Expected Result**:

- currentMetric = -45 (cumulative reduction)
- progress = 90% (|-45|/|50| \* 100)

---

### 2.3 Increase Metric Type Tests

#### Test Case 2.3.1: Baseline Change Calculation

**Objective**: Verify Increase measures change from previous year
**Setup**:

- `metricType: "Increase"`
- `previousMetric: {"value": 500}` (last year's value)
- `targetMetric: {"value": 100}` (target increase)
- Current: 580 (or latest quarter value)

**Steps**:

1. Set previousMetric
2. Set quarterly record to 580
3. Calculate progress

**Expected Result**:

- Progress = 80% [(580-500) / 100 * 100]
- Formula: (Current - Previous) / Target

#### Test Case 2.3.2: Zero Target Handling

**Objective**: Verify handling when target increase is 0
**Setup**:

- `previousMetric: 100`
- `targetMetric: 0`
- Current: 150

**Steps**:

1. Check progress calculation

**Expected Result**: Progress = 100% (increase detected, target was 0)

---

### 2.4 Decrease Metric Type Tests

#### Test Case 2.4.1: Reduction Achievement (Crime Rate Example)

**Objective**: Verify Decrease for lower-is-better metrics
**Setup**:

- `metricType: "Decrease"`
- `previousMetric: {"value": 1000}` (baseline crimes)
- `targetMetric: {"value": 100}` (target reduction)
- Current: 850 (150 crimes reduced)

**Steps**:

1. Calculate progress

**Expected Result**:

- Progress = 60% [(1000-850) / (1000-1000+100) * 100] = [150/100]
- capped at 100%

---

### 2.5 Maintain Metric Type Tests

#### Test Case 2.5.1: Constant Value Maintenance

**Objective**: Verify Maintain for constant-target metrics
**Setup**:

- `metricType: "Maintain"`
- `targetMetric: {"value": 99.5}` (service level %)
- Current: 99.5

**Steps**:

1. Set current to exactly match target
2. Check progress

**Expected Result**: Progress = 100% (exact match within 1% tolerance)

#### Test Case 2.5.2: Tolerance Range (±1%)

**Objective**: Verify 1% tolerance for floating point
**Setup**:

- Target: 100
- Current: 100.5 (0.5% variance)

**Steps**:

1. Check progress

**Expected Result**: Progress = 100% (within tolerance)

#### Test Case 2.5.3: Outside Tolerance

**Objective**: Verify failure outside tolerance
**Setup**:

- Target: 100
- Current: 102 (2% variance)

**Steps**:

1. Check progress

**Expected Result**: Progress = 0% (outside 1% tolerance)

---

### 2.6 Completion Override Tests

#### Test Case 2.6.1: isDone=true Forces 100%

**Objective**: Verify isDone flag overrides calculated progress
**Setup**:

- Activity with metric calculations yielding 50% progress
- Set `isDone: true`

**Steps**:

1. Toggle isDone to true
2. Check progress value

**Expected Result**: Progress immediately = 100%

#### Test Case 2.6.2: isDone=false Reverts Calculation

**Objective**: Verify toggling isDone back recalculates
**Setup**:

- Activity with isDone=true (progress=100%)
- Set `isDone: false`

**Steps**:

1. Toggle isDone to false
2. System recalculates from quarterly records

**Expected Result**: Progress reverts to calculated value (e.g., 50%)

#### Test Case 2.6.3: Status='Done' Sets isDone

**Objective**: Verify status update also sets isDone
**Steps**:

1. Apply report with `new_status: 'Done'`
2. Check isDone field

**Expected Result**: isDone = true; progress = 100%

---

### 2.7 Progress Rollup Tests

#### Test Case 2.7.1: Activity → Task Rollup

**Objective**: Verify task progress sums weighted activities
**Setup**:

- Task with 2 activities:
  - Activity A: progress=100, weight=2
  - Activity B: progress=50, weight=2

**Steps**:

1. Calculate task progress

**Expected Result**:

- Task progress = (100*2 + 50*2) / (2+2) \* 100 = 75%

#### Test Case 2.7.2: Task → Goal Rollup

**Objective**: Verify goal progress sums weighted tasks
**Setup**:

- Goal with 2 tasks:
  - Task A: progress=100, weight=3
  - Task B: progress=60, weight=2

**Steps**:

1. Calculate goal progress

**Expected Result**:

- Goal progress = (100*3 + 60*2) / (3+2) \* 100 = 84%

#### Test Case 2.7.3: Automatic Trigger on Activity Update

**Objective**: Verify triggers fire when activity updated
**Steps**:

1. Update activity progress via report
2. Immediately query task and goal

**Expected Result**: Task and goal progress auto-updated

---

## Part 3: Excel System Redesign Testing

### 3.1 Hierarchical Export Format Tests

#### Test Case 3.1.1: Download Template Structure

**Objective**: Verify template has correct hierarchical layout
**Steps**:

1. Click "Download Template" button
2. Open Excel file
3. Inspect sheet structure

**Expected Result**:

- Single sheet named "Master Report"
- Columns: Level | Title | Metric Type | Target | Current | Previous | Progress | Status | Weight | Due Date | Notes
- Rows structure: GOAL → TASK → ACTIVITY (indented levels)
- First row bold with blue background

#### Test Case 3.1.2: Merged Cells & Formatting

**Objective**: Verify professional formatting applied
**Steps**:

1. Export template
2. Check cell formatting in Excel

**Expected Result**:

- Header row: bold white font, blue background
- Goal rows: gray background, slightly bold
- Task/Activity rows: light gray borders
- Proper column widths for readability

#### Test Case 3.1.3: Metric Data Display

**Objective**: Verify metrics displayed as single values
**Steps**:

1. Export with activities containing metrics
2. Check Target/Current/Previous columns

**Expected Result**:

- JSON objects extracted to single numeric value
- Metric Key shown in "Metric Type" column

#### Test Case 3.1.4: Current Metric Population

**Objective**: Verify currentMetric from database shown
**Steps**:

1. Create activity, apply report with metrics
2. Export template
3. Check "Current" column

**Expected Result**: Current value populated from activity.currentMetric

---

### 3.2 Bulk Import Format Tests

#### Test Case 3.2.1: Template Parsing

**Objective**: Verify import recognizes exported template format
**Steps**:

1. Export template
2. Add/modify rows (add new activity)
3. Import the file
4. Check if new activity created

**Expected Result**: New activity created successfully

#### Test Case 3.2.2: Deduplication - Existing Activity Update

**Objective**: Verify import updates existing activities by title match
**Setup**:

- Existing goal "Q1 Goals" with task "Task A" with activity "Activity 1"
- Modify Activity 1 weight to 5, status to "In Progress"

**Steps**:

1. Export template (will include Activity 1)
2. Modify the exported row's weight from original to 5
3. Change status to "In Progress"
4. Import modified file
5. Check Activity 1 in database

**Expected Result**: Activity 1 updated (not duplicated); weight=5, status updated

#### Test Case 3.2.3: Deduplication - New Activity Creation

**Objective**: Verify new activities created if not matched
**Steps**:

1. Export template
2. Add new row at activity level with unique title "New Activity"
3. Import
4. Check task activities

**Expected Result**: "New Activity" created as new record

#### Test Case 3.2.4: Metric Type Preservation

**Objective**: Verify metricType imported correctly
**Steps**:

1. Create activity with metricType="Increase"
2. Export
3. Import same file
4. Check activity metricType

**Expected Result**: metricType="Increase" preserved

#### Test Case 3.2.5: Legacy Format Fallback

**Objective**: Verify import still works with old flat format
**Steps**:

1. Use existing `/api/reports/import` (flat Goals/Tasks/Activities sheets)
2. Import file
3. Verify data created

**Expected Result**: Legacy format still works; system falls back

---

### 3.3 Bulk Import Error Handling

#### Test Case 3.3.1: Missing File

**Objective**: Verify error when file not provided
**Steps**:

1. Click "Bulk Import" without selecting file
2. Check error message

**Expected Result**: "Excel file is required" error

#### Test Case 3.3.2: Invalid Format

**Objective**: Verify error with malformed Excel
**Steps**:

1. Upload text file instead of .xlsx
2. Check error

**Expected Result**: "Invalid Excel file format" error

#### Test Case 3.3.3: Empty Master Report Sheet

**Objective**: Verify error if no data to import
**Steps**:

1. Create blank Excel file with "Master Report" sheet (header only)
2. Upload
3. Check error

**Expected Result**: "Must contain at least one Goal" error

#### Test Case 3.3.4: Import Summary Display

**Objective**: Verify success message shows counts
**Steps**:

1. Import valid file with 2 goals, 3 tasks, 5 activities
2. Check success message

**Expected Result**:

```
✓ Import successful!
{
  "goals_created": 2,
  "tasks_created": 3,
  "activities_created": 5,
  "metrics_updated": 5,
  "errors": []
}
```

---

### 3.4 Round-Trip Testing

#### Test Case 3.4.1: Export → Modify → Import

**Objective**: Verify full cycle data consistency
**Steps**:

1. Export template (captures current state)
2. Modify activity weight: 5 → 10
3. Change status: "To Do" → "In Progress"
4. Import modified file
5. Query activity from database

**Expected Result**:

- Activity weight = 10
- Activity status = "In Progress"
- No duplication
- History preserved

#### Test Case 3.4.2: Metrics Retained Through Cycle

**Objective**: Verify metric data not lost in export/import
**Setup**:

- Activity with currentMetric: {"value": 450}
- metricType: "Plus"
- Progress: 45%

**Steps**:

1. Export template
2. Import immediately (no changes)
3. Query activity

**Expected Result**:

- currentMetric preserved
- Progress unchanged
- metricType preserved

---

## Test Execution Checklist

### Security Testing (Part 1)

- [ ] XSS payload injection (1.1.1 - 1.1.4)
- [ ] Input validation (1.2.1 - 1.2.3)
- [ ] Audit logs verify suspicious attempts
- [ ] No database corruption from injection attempts

### Metric Calculation Testing (Part 2)

- [ ] Plus metrics (2.1.1 - 2.1.2)
- [ ] Minus metrics (2.2.1)
- [ ] Increase metrics (2.3.1 - 2.3.2)
- [ ] Decrease metrics (2.4.1)
- [ ] Maintain metrics (2.5.1 - 2.5.3)
- [ ] Completion override (2.6.1 - 2.6.3)
- [ ] Progress rollup (2.7.1 - 2.7.3)

### Excel System Testing (Part 3)

- [ ] Export format & structure (3.1.1 - 3.1.4)
- [ ] Import parsing (3.2.1 - 3.2.5)
- [ ] Error handling (3.3.1 - 3.3.4)
- [ ] Round-trip consistency (3.4.1 - 3.4.2)

---

## Regression Testing

### Critical Paths to Verify

1. **Report Submission**: Submit activity report → verify metrics calculated
2. **Master Report**: Load master report → verify all progress values display
3. **Activity CRUD**: Create/update/delete activities → verify cascade to tasks/goals
4. **Quarterly Records**: Manually edit quarterly records → verify progress recalculates
5. **Multi-Group Scenarios**: Activities in different groups → verify isolation

### Performance Testing

- Export master report with 100+ activities: < 5 seconds
- Import file with 50+ goals: < 10 seconds
- Progress recalculation: < 1 second per activity

---

## Sign-Off

Testing completed by: ********\_\_\_********  
Date: ********\_\_\_********  
Notes/Issues:

---

---

✅ All tests passed  
⚠️ Minor issues (document below)  
❌ Critical failures (address before deployment)
