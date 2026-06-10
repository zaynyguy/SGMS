# SGMS (Project)

Overview

SGMS is a full-stack application with a Node.js/Express backend and a React (Vite) frontend. The repository includes Docker definitions for local development with Postgres, plus helper scripts for DB migrations and seeding.

Primary folders

- backend/: Express API server, DB access, routes, services, and scripts.
- frontend/: Vite + React frontend (TailwindCSS).
- docker/: Helper Docker assets (if used separately).
- uploads/: Uploaded files used by app in development.
- docker-compose.yml: Development compose file (db, server, web)

Quick start (using Docker Compose)

1. Copy or create an `.env` with the required environment variables (see "Environment variables" below).
2. From project root, run:

```bash
docker compose up --build
```

This will build/run Postgres, the backend (server) and the frontend (web). The backend performs migrations and seeds on startup (see `docker-compose.yml` server command).

Backend (development)

- Files: [backend/](backend/)
- Entry: [backend/src/server.js](backend/src/server.js)
- Scripts (in [backend/package.json](backend/package.json)):
  - `dev`: nodemon src/server.js
  - `start`: node src/server.js
  - `migrate`: node src/scripts/migrate.js
  - `seed`: node src/scripts/seed.js

To run backend locally (not in Docker):

```bash
cd backend
npm install
npm run dev
```

Frontend (development)

- Files: [frontend/](frontend/)
- Entry: [frontend/src/main.jsx](frontend/src/main.jsx)
- Scripts (in [frontend/package.json](frontend/package.json)):
  - `dev`: vite
  - `build`: vite build
  - `preview`: vite preview

To run frontend locally:

```bash
cd frontend
npm install
npm run dev
```

Environment variables

Use [backend/.env](backend/.env) as a reference. Key variables include:

- `DATABASE_URL` — Postgres connection string used by the backend.
- `PORT` — Backend port (default 5000).
- `FRONTEND_ORIGIN` — Comma-separated allowed frontend origins (CORS).
- `JWT_SECRET`, `JWT_EXPIRES_IN`, `JWT_ISSUER` — JWT settings.
- `ADMIN_USERNAME`, `ADMIN_PASSWORD` — Default admin used by seed script.
- `UPLOAD_DIR`, `MAX_UPLOAD_MB` — File upload config.
- `ADVISORY_LOCK_KEY` — Used by scheduled jobs.

Notes: Do NOT commit secrets to source control. Keep a `.env.example` (without secrets) in repo instead.

Database

- The project uses Postgres (see `docker-compose.yml`).
- DB helper: [backend/src/db.js](backend/src/db.js) exports `query`, `connect` and `tx` helpers.
- Migration and seed scripts are in [backend/src/scripts/](backend/src/scripts/).

Socket / Real-time

- Socket initialization: [backend/src/services/socketService.js](backend/src/services/socketService.js)
- The frontend connects with socket.io-client.

Jobs

- Monthly snapshot job located at [backend/src/jobs/monthlySnapshot.js](backend/src/jobs/monthlySnapshot.js) and scheduled in server startup.

File uploads

- Uploaded files are stored in `uploads/` by default. Upload handling is in [backend/src/middleware/uploadMiddleware.js](backend/src/middleware/uploadMiddleware.js) and services/uploadService.js.

Testing

- The backend has `jest` and `supertest` in devDependencies, but no `test` script defined. Consider adding `test` script in [backend/package.json](backend/package.json) to run unit/integration tests.

Linting & Formatting

- Frontend uses `eslint` and Tailwind. Add/enable linting scripts or CI checks as needed.

Common commands

- Build frontend: `cd frontend && npm run build`
- Start backend: `cd backend && npm start`
- Run migrations: `cd backend && npm run migrate`
- Seed DB: `cd backend && npm run seed`

Useful file references

- [docker-compose.yml](docker-compose.yml)
- [backend/package.json](backend/package.json)
- [frontend/package.json](frontend/package.json)
- [backend/src/server.js](backend/src/server.js)
- [backend/src/db.js](backend/src/db.js)
- [backend/.env](backend/.env)

---

## SGMS System Architecture: Progress Calculation & Import/Export

### Overview

SGMS uses a **hierarchical structure** with cascading progress calculations:
- **Goals** contain **Tasks** 
- **Tasks** contain **Activities**
- **Activities** have metrics that roll up to task progress
- **Task** progress rolls up to **goal** progress

---

### Progress Calculation System

#### How Progress Works

Progress at each level is calculated as a **weighted average** of its children:

```
Activity Progress = Based on metric type (Plus, Minus, Increase, Decrease, Maintain)
Task Progress     = SUM(activity.progress × activity.weight) / SUM(activity.weight)
Goal Progress     = SUM(task.progress × task.weight) / SUM(task.weight)
```

#### Activity Progress by Metric Type

1. **Plus** (cumulative, higher is better)
   - Example: Number of events held
   - Formula: `progress = (current_metric / target_metric) × 100%`

2. **Minus** (cumulative reduction, lower is better)
   - Example: Defects reduced
   - Formula: `progress = (|current| / |target|) × 100%`

3. **Increase** (snapshot, must grow from baseline)
   - Example: Revenue increase
   - Formula: `progress = ((current - previous) / target_increase) × 100%`

4. **Decrease** (snapshot, must reduce from baseline)
   - Example: Crime rate reduction
   - Formula: `progress = ((previous - current) / target_decrease) × 100%`

5. **Maintain** (snapshot, keep value constant)
   - Example: Uptime 99.5%
   - Formula: `progress = 100%` if current ≈ target

#### Completion Override

When an activity is marked as **complete** (`isDone = true`):
- Progress is **always 100%**, regardless of metrics
- Used by admins for manual completion marking
- Override takes precedence over calculated metrics

---

### Admin vs User Workflows

#### Admin Capabilities
Admins can:
- Directly update activity status (To Do → In Progress → Complete)
- Mark activities as complete (`isDone = true`)
- Update metrics in the UI
- Update all properties: title, weight, metricType, targets, etc.
- Changes apply immediately to database
- Progress recalculates in real-time

#### User Capabilities
Regular users:
- Submit progress via the **Report System** (not direct edits)
- Submit quarterly metrics for activities
- Cannot directly change activity status
- Reports are reviewed/approved by admins
- Progress updates only when reports are finalized/submitted

---

### Import/Export System

#### Bulk Import Feature

Located under **Project Management → Bulk Import**

**Purpose**: Allow admins to update Goals, Tasks, and Activities in bulk from an Excel file

**How to Use**:

1. **Download Template**
   - Click "Download Master Report" to get template
   - Contains current Goals, Tasks, and Activities

2. **Edit Excel File**
   - Modify existing rows or add new ones
   - Columns: Goal Title, Goal Description, Task Title, Task Description, Activity Title, metricType, targetMetric, currentMetric, isDone, weight, status
   - isDone column: `true`/`false` to mark activities complete

3. **Upload File**
   - Click "Upload" and select the Excel file
   - System validates and imports changes
   - Returns summary: created/updated/skipped items
   - Progress automatically recalculates

**File Format Requirements**:
- Excel file (.xlsx or .xls)
- Maximum 50MB
- Must contain "Master Report" sheet
- Hierarchical structure: Goals contain Tasks contain Activities

#### Import Logic

When importing:
1. **Existing Goals/Tasks**: Updates if found by name
2. **New Goals/Tasks**: Creates new records
3. **Existing Activities**: Updates metadata (description, weight, status, metrics, isDone)
4. **New Activities**: Creates with provided properties
5. **Progress Recalculation**: Automatically calls `accumulate_metrics()` for all affected activities
6. **Cascade Updates**: Progress rolls up Activity → Task → Goal

---

### Recent Fixes (June 2024)

#### Fix 1: Activity Status Changes Now Update Progress
**Problem**: Changing `isDone` to `true` didn't update task progress
**Solution**: Added explicit `accumulate_metrics()` call when isDone changes in activity update endpoint
**Files Modified**: [backend/src/controllers/activitiesController.js](backend/src/controllers/activitiesController.js)

#### Fix 2: Import System Properly Updates Database
**Problem**: Import only recalculated progress for new metrics, not for status/isDone changes
**Solution**: 
- Added `isDone` field to import update query
- Always call `accumulate_metrics()` after activity updates
- Ensures progress cascades for all changes
**Files Modified**: [backend/src/controllers/reportsController.js](backend/src/controllers/reportsController.js)

#### Fix 3: Progress Rollup Triggers
**Status**: Verified via migrations 002-004
**Migration Files**:
- [002_fix_progress_rollup.sql](backend/src/scripts/migrations/002_fix_progress_rollup.sql)
- [003_update_progress_logic.sql](backend/src/scripts/migrations/003_update_progress_logic.sql)
- [004_fix_progress_rollup_triggers.sql](backend/src/scripts/migrations/004_fix_progress_rollup_triggers.sql)

---

### Testing the Fixes

#### Test 1: Direct Activity Update
```bash
# 1. Create an activity
POST /api/tasks/{taskId}/activities
{
  "title": "Test Activity",
  "weight": 50,
  "metricType": "Plus",
  "targetMetric": {"value": 100}
}

# 2. Mark as complete
PUT /api/activities/{activityId}
{
  "isDone": true
}

# 3. Verify task progress is now 100%
GET /api/tasks/{taskId}
# Expected: {"progress": 100, ...}
```

#### Test 2: Bulk Import with Status Changes
```bash
# 1. Download master report template
GET /api/reports/master

# 2. Edit Excel: set isDone=true for some activities

# 3. Upload updated file
POST /api/reports/bulk-import-excel
# With multipart form data: file=<excel>

# 4. Check response
# Expected: {
#   "message": "Excel data imported successfully.",
#   "summary": {
#     "activities_updated": 5,
#     "metrics_updated": 3,
#     "errors": []
#   }
# }

# 5. Verify in database
GET /api/goals/{goalId}
# Expected: goal.progress has been recalculated
```

#### Test 3: Progress Cascade
```bash
# 1. Update Activity: isDone=true → Activity.progress=100%
# 2. Verify Task: task.progress recalculates from weighted activities
# 3. Verify Goal: goal.progress recalculates from weighted tasks
```

---

### Database Triggers

The system uses PostgreSQL triggers for automatic progress recalculation:

**Trigger**: `after_activities_change` (on Activities table)
- Fires on: INSERT, UPDATE, DELETE
- Action: Recalculates task progress using weighted average
- Then: Updates parent goal progress

**Function**: `trg_recalc_task_progress()`
- Calculates: `SUM(activity.progress × activity.weight) / SUM(activity.weight)`
- Updates: Task.progress and Task.status if progress ≥ 100%

**Function**: `trg_recalc_goal_progress()`
- Calculates: `SUM(task.progress × task.weight) / SUM(task.weight)`
- Updates: Goal.progress and Goal.status if progress ≥ 100%

---

### Common Issues & Solutions

**Issue**: Activity isDone changed but progress didn't update
- **Solution**: Run migrations: `npm run migrate`
- **Verification**: Check if trigger exists: `SELECT * FROM pg_trigger WHERE tgname = 'after_activities_change'`

**Issue**: Bulk import shows "Unsupported file type"
- **Solution**: Ensure file is Excel (.xlsx or .xls), not CSV
- **Verification**: Check uploadMiddleware.js for allowed MIME types

**Issue**: Import doesn't recalculate goal progress
- **Solution**: Verify accumulate_metrics function exists: `SELECT * FROM pg_proc WHERE proname = 'accumulate_metrics'`
- **Verification**: Run a test import and check for errors in console

**Issue**: Weights don't add up correctly
- **Error**: "Cannot set activity weight to X. Task total is Y..."
- **Solution**: Ensure sum of all activity weights ≤ task weight
- **Note**: Allow for floating point precision: 0.01 margin

---

### API Reference: Bulk Import

**Endpoint**: `POST /api/reports/bulk-import-excel`

**Requirements**:
- Authentication: Requires `manage_reports` permission
- File: Multipart form data with field name "file"
- Max size: 50MB

**Request**:
```
POST /api/reports/bulk-import-excel
Content-Type: multipart/form-data

file: <xlsx file>
```

**Response Success** (200):
```json
{
  "message": "Excel data imported successfully.",
  "summary": {
    "goals_created": 2,
    "goals_updated": 3,
    "tasks_created": 5,
    "tasks_updated": 8,
    "activities_created": 12,
    "activities_updated": 15,
    "metrics_updated": 20,
    "errors": []
  }
}
```

**Response Error** (400/500):
```json
{
  "error": "Excel file must contain at least one Goal in the Master Report sheet."
}
```

---

### Performance Notes

- **Large Imports**: 100+ activities may take 30-60 seconds
- **Progress Cascade**: Each activity update triggers 2 SQL updates (task, then goal)
- **Weighted Calculations**: O(n) where n = number of children per node
- **Recommendations**: 
  - Batch imports during off-hours for large datasets
  - Monitor database query logs if imports exceed 2 minutes

---

License / Next steps

- Add a `.env.example` and remove real secrets from the repo.
- Add a `test` script and CI pipeline for running tests and linting.
- Create UI page for Bulk Import under Project Management section.
- Add more comprehensive test coverage for progress calculation.
