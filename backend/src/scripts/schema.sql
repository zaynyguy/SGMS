-- Drop existing objects (dev only)
DROP TABLE IF EXISTS "Attachments" CASCADE;
DROP TABLE IF EXISTS "Reports" CASCADE;
DROP TABLE IF EXISTS "SystemSettings" CASCADE;
DROP TABLE IF EXISTS "Activities" CASCADE;
DROP TABLE IF EXISTS "Tasks" CASCADE;
DROP TABLE IF EXISTS "Goals" CASCADE;
DROP TABLE IF EXISTS "UserGroups" CASCADE;
DROP TABLE IF EXISTS "RolePermissions" CASCADE;
DROP TABLE IF EXISTS "Users" CASCADE;
DROP TABLE IF EXISTS "Permissions" CASCADE;
DROP TABLE IF EXISTS "Roles" CASCADE;
DROP TABLE IF EXISTS "Groups" CASCADE;
DROP TABLE IF EXISTS "Notifications" CASCADE;
DROP TABLE IF EXISTS "AuditLogs" CASCADE;
DROP TABLE IF EXISTS "ProgressHistory" CASCADE;
DROP TABLE IF EXISTS "RefreshTokens" CASCADE;

DROP SEQUENCE IF EXISTS goals_rollno_seq CASCADE;

DROP TYPE IF EXISTS goal_status CASCADE;
DROP TYPE IF EXISTS task_status CASCADE;
DROP TYPE IF EXISTS activity_status CASCADE;
DROP TYPE IF EXISTS report_status CASCADE;

-- ENUMS
CREATE TYPE goal_status AS ENUM ('Not Started', 'In Progress', 'Completed', 'On Hold');
CREATE TYPE task_status AS ENUM ('To Do', 'In Progress', 'Done', 'Blocked');
CREATE TYPE activity_status AS ENUM ('To Do', 'In Progress', 'Done');
CREATE TYPE report_status AS ENUM ('Pending', 'Approved', 'Rejected');

-- ROLES & PERMISSIONS
CREATE TABLE "Roles" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(255) NOT NULL UNIQUE,
  "description" VARCHAR(255),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "Permissions" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(255) NOT NULL UNIQUE,
  "description" VARCHAR(255),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "Users" (
  "id" SERIAL PRIMARY KEY,
  "username" VARCHAR(255) NOT NULL UNIQUE,
  "name" VARCHAR(255),
  "profilePicture" TEXT,
  "password" VARCHAR(255) NOT NULL,
  "roleId" INTEGER REFERENCES "Roles"("id") ON DELETE SET NULL,
  "language" VARCHAR(10) DEFAULT 'en',
  "token_version" INTEGER DEFAULT 0 NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "RolePermissions" (
  "id" SERIAL PRIMARY KEY,
  "roleId" INTEGER NOT NULL REFERENCES "Roles"("id") ON DELETE CASCADE,
  "permissionId" INTEGER NOT NULL REFERENCES "Permissions"("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("roleId","permissionId")
);

-- GROUPS & MEMBERSHIP
CREATE TABLE "Groups" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(255) NOT NULL UNIQUE,
  "description" TEXT,
  "profilePicture" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "UserGroups" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL REFERENCES "Users"("id") ON DELETE CASCADE,
  "groupId" INTEGER NOT NULL REFERENCES "Groups"("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("userId","groupId")
);

-- GOALS
CREATE SEQUENCE goals_rollno_seq START 1;

CREATE TABLE "Goals" (
  "id" SERIAL PRIMARY KEY,
  "rollNo" INTEGER DEFAULT nextval('goals_rollno_seq'),
  "title" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "groupId" INTEGER REFERENCES "Groups"("id") ON DELETE SET NULL,
  "startDate" DATE,
  "endDate" DATE,
  "status" goal_status NOT NULL DEFAULT 'Not Started',
  "progress" INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  "weight" NUMERIC NOT NULL DEFAULT 100,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE "Goals" ADD CONSTRAINT chk_goals_rollno_positive CHECK ("rollNo" > 0);
CREATE UNIQUE INDEX IF NOT EXISTS ux_goals_rollno ON "Goals" ("rollNo");
CREATE INDEX idx_goals_group_status ON "Goals" ("groupId","status");

-- TASKS
CREATE TABLE "Tasks" (
  "id" SERIAL PRIMARY KEY,
  "goalId" INTEGER NOT NULL REFERENCES "Goals"("id") ON DELETE CASCADE,
  "rollNo" INTEGER,
  "title" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "status" task_status NOT NULL DEFAULT 'To Do',
  "assigneeId" INTEGER REFERENCES "Users"("id") ON DELETE SET NULL,
  "dueDate" DATE,
  "progress" INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  "weight" NUMERIC NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE "Tasks" ADD CONSTRAINT chk_tasks_rollno_positive CHECK ("rollNo" IS NULL OR "rollNo" > 0);
CREATE UNIQUE INDEX IF NOT EXISTS ux_tasks_goal_roll ON "Tasks" ("goalId","rollNo");
CREATE INDEX idx_tasks_goal_id ON "Tasks" ("goalId");
CREATE INDEX idx_tasks_assignee_id ON "Tasks" ("assigneeId");

-- ACTIVITIES
CREATE TABLE "Activities" (
  "id" SERIAL PRIMARY KEY,
  "taskId" INTEGER NOT NULL REFERENCES "Tasks"("id") ON DELETE CASCADE,
  "parentId" INTEGER REFERENCES "Activities"("id") ON DELETE CASCADE,
  "rollNo" INTEGER,
  "title" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "status" activity_status NOT NULL DEFAULT 'To Do',
  "dueDate" DATE,
  "targetMetric" JSONB DEFAULT '{}'::jsonb,
  "currentMetric" JSONB DEFAULT '{}'::jsonb,
  "progress" INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  "weight" NUMERIC NOT NULL DEFAULT 0,
  "isDone" BOOLEAN DEFAULT false,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE "Activities" ADD CONSTRAINT chk_activities_rollno_positive CHECK ("rollNo" IS NULL OR "rollNo" > 0);
CREATE UNIQUE INDEX IF NOT EXISTS ux_activities_task_roll ON "Activities" ("taskId","rollNo");
CREATE INDEX idx_activities_task_id ON "Activities" ("taskId");
CREATE INDEX idx_activities_parent_id ON "Activities" ("parentId");

-- SYSTEM SETTINGS
CREATE TABLE "SystemSettings" (
  key VARCHAR(255) PRIMARY KEY,
  value JSONB,
  description TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- REPORTS (added applied fields to avoid double-apply)
CREATE TABLE "Reports" (
  "id" SERIAL PRIMARY KEY,
  "activityId" INT NOT NULL REFERENCES "Activities"(id) ON DELETE CASCADE,
  "userId" INT REFERENCES "Users"(id) ON DELETE SET NULL,
  "narrative" TEXT,
  "metrics_data" JSONB DEFAULT '{}'::jsonb,
  "new_status" VARCHAR(50),
  "status" report_status NOT NULL DEFAULT 'Pending',
  "adminComment" TEXT,
  "resubmissionDeadline" TIMESTAMPTZ,
  "applied" BOOLEAN DEFAULT false,
  "appliedBy" INT REFERENCES "Users"(id) ON DELETE SET NULL,
  "appliedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_reports_userId ON "Reports" ("userId");
CREATE INDEX idx_reports_activityId ON "Reports" ("activityId");
CREATE INDEX idx_reports_applied ON "Reports" ("applied");

-- ATTACHMENTS
CREATE TABLE "Attachments" (
  "id" SERIAL PRIMARY KEY,
  "reportId" INT NOT NULL REFERENCES "Reports"(id) ON DELETE CASCADE,
  "publicId" VARCHAR(255),
  "fileName" VARCHAR(255) NOT NULL,
  "filePath" TEXT NOT NULL,
  "fileType" VARCHAR(100) NOT NULL,
  "provider" VARCHAR(20) DEFAULT 'local',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_attachments_reportId ON "Attachments" ("reportId");

-- NOTIFICATIONS
CREATE TABLE "Notifications" (
  "id" SERIAL PRIMARY KEY,
  "userId" INT NOT NULL REFERENCES "Users"("id") ON DELETE CASCADE,
  "type" VARCHAR(50) NOT NULL,
  "message" TEXT NOT NULL,
  "meta" JSONB DEFAULT '{}'::jsonb,
  "level" VARCHAR(20) DEFAULT 'info',
  "isRead" BOOLEAN DEFAULT false,
  "createdAt" TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_notifications_userid_createdAt ON "Notifications" ("userId","createdAt");

-- AUDIT LOGS
CREATE TABLE "AuditLogs" (
  "id" SERIAL PRIMARY KEY,
  "userId" INT REFERENCES "Users"("id") ON DELETE SET NULL,
  "action" VARCHAR(100) NOT NULL,
  "entity" VARCHAR(100) NOT NULL,
  "entityId" INT,
  "details" JSONB,
  "ip" VARCHAR(100),
  "userAgent" TEXT,
  "before" JSONB,
  "after" JSONB,
  "createdAt" TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_auditlogs_createdAt ON "AuditLogs" ("createdAt");

-- REFRESH JWT TOKENS
CREATE TABLE "RefreshTokens" (
  id SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL REFERENCES "Users"(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  revoked BOOLEAN DEFAULT false,
  createdAt TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_refresh_tokens_userid ON "RefreshTokens"("userId");

-- PROGRESS HISTORY
CREATE TABLE "ProgressHistory" (
  id SERIAL PRIMARY KEY,
  entity_type VARCHAR(20) NOT NULL,
  entity_id INTEGER NOT NULL,
  group_id INTEGER,
  progress INTEGER NOT NULL DEFAULT 0,
  metrics JSONB DEFAULT '{}'::jsonb,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  snapshot_month DATE NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_progresshistory_entity ON "ProgressHistory"(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_progresshistory_recorded_at ON "ProgressHistory"(recorded_at);
CREATE INDEX IF NOT EXISTS idx_progresshistory_snapshot_month ON "ProgressHistory"(snapshot_month);
CREATE UNIQUE INDEX IF NOT EXISTS ux_progresshistory_entity_month
  ON "ProgressHistory"(entity_type, entity_id, snapshot_month);

-- update_updatedAt_column()
CREATE OR REPLACE FUNCTION update_updatedAt_column() RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER set_updatedAt_Roles BEFORE UPDATE ON "Roles" FOR EACH ROW EXECUTE FUNCTION update_updatedAt_column();
CREATE TRIGGER set_updatedAt_Permissions BEFORE UPDATE ON "Permissions" FOR EACH ROW EXECUTE FUNCTION update_updatedAt_column();
CREATE TRIGGER set_updatedAt_Users BEFORE UPDATE ON "Users" FOR EACH ROW EXECUTE FUNCTION update_updatedAt_column();
CREATE TRIGGER set_updatedAt_RolePermissions BEFORE UPDATE ON "RolePermissions" FOR EACH ROW EXECUTE FUNCTION update_updatedAt_column();
CREATE TRIGGER set_updatedAt_Groups BEFORE UPDATE ON "Groups" FOR EACH ROW EXECUTE FUNCTION update_updatedAt_column();
CREATE TRIGGER set_updatedAt_UserGroups BEFORE UPDATE ON "UserGroups" FOR EACH ROW EXECUTE FUNCTION update_updatedAt_column();
CREATE TRIGGER set_updatedAt_Goals BEFORE UPDATE ON "Goals" FOR EACH ROW EXECUTE FUNCTION update_updatedAt_column();
CREATE TRIGGER set_updatedAt_Tasks BEFORE UPDATE ON "Tasks" FOR EACH ROW EXECUTE FUNCTION update_updatedAt_column();
CREATE TRIGGER set_updatedAt_Activities BEFORE UPDATE ON "Activities" FOR EACH ROW EXECUTE FUNCTION update_updatedAt_column();
CREATE TRIGGER set_updatedAt_SystemSettings BEFORE UPDATE ON "SystemSettings" FOR EACH ROW EXECUTE FUNCTION update_updatedAt_column();
CREATE TRIGGER set_updatedAt_Reports BEFORE UPDATE ON "Reports" FOR EACH ROW EXECUTE FUNCTION update_updatedAt_column();

-- Automatic rollNo assignment for Tasks (unique per goal)
CREATE OR REPLACE FUNCTION trg_assign_task_rollno() RETURNS TRIGGER AS $$
DECLARE
  v_max INT;
BEGIN
  IF NEW."rollNo" IS NOT NULL THEN
    IF NEW."rollNo" <= 0 THEN
      RAISE EXCEPTION 'task rollNo must be > 0';
    END IF;
    RETURN NEW;
  END IF;
  SELECT COALESCE(MAX("rollNo"), 0) + 1 INTO v_max FROM "Tasks" WHERE "goalId" = NEW."goalId";
  NEW."rollNo" := v_max;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS before_tasks_insert_assign_rollno ON "Tasks";
CREATE TRIGGER before_tasks_insert_assign_rollno
BEFORE INSERT ON "Tasks"
FOR EACH ROW
EXECUTE FUNCTION trg_assign_task_rollno();

-- Automatic rollNo assignment for Activities (unique per task)
CREATE OR REPLACE FUNCTION trg_assign_activity_rollno() RETURNS TRIGGER AS $$
DECLARE
  v_max INT;
BEGIN
  IF NEW."rollNo" IS NOT NULL THEN
    IF NEW."rollNo" <= 0 THEN
      RAISE EXCEPTION 'activity rollNo must be > 0';
    END IF;
    RETURN NEW;
  END IF;
  SELECT COALESCE(MAX("rollNo"), 0) + 1 INTO v_max FROM "Activities" WHERE "taskId" = NEW."taskId";
  NEW."rollNo" := v_max;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS before_activities_insert_assign_rollno ON "Activities";
CREATE TRIGGER before_activities_insert_assign_rollno
BEFORE INSERT ON "Activities"
FOR EACH ROW
EXECUTE FUNCTION trg_assign_activity_rollno();

-- Recalc task progress from activities
CREATE OR REPLACE FUNCTION trg_recalc_task_progress() RETURNS TRIGGER AS $$
DECLARE
v_task_id INT;
t_weight NUMERIC;
sum_done_weight NUMERIC;
sum_activity_weights NUMERIC;
computed_progress INT;
BEGIN
IF TG_OP = 'DELETE' THEN
v_task_id := OLD."taskId";
ELSE
v_task_id := NEW."taskId";
END IF;

SELECT COALESCE(SUM(a.weight),0) INTO sum_activity_weights FROM "Activities" a WHERE a."taskId" = v_task_id;
-- MODIFIED: Use activity.progress * weight, not just isDone. This links metric progress to task progress.
SELECT COALESCE(SUM(CASE WHEN a.progress >= 100 THEN a.weight ELSE a.progress * a.weight / 100 END),0)
INTO sum_done_weight FROM "Activities" a WHERE a."taskId" = v_task_id;

SELECT t."weight" INTO t_weight FROM "Tasks" t WHERE t.id = v_task_id;

IF t_weight IS NULL OR t_weight = 0 THEN
-- Fallback if task has no weight: average of activity progress
IF sum_activity_weights > 0 THEN
computed_progress := LEAST(100, ROUND(sum_done_weight / sum_activity_weights * 100));
ELSE
-- Fallback if no activities have weight: simple average
SELECT COALESCE(AVG(a.progress)::int,0)
INTO computed_progress FROM "Activities" a WHERE a."taskId" = v_task_id;
END IF;
ELSE
-- Standard case: progress is % of total task weight
computed_progress := LEAST(100, ROUND(sum_done_weight / NULLIF(t_weight,0) * 100));
END IF;

-- MODIFIED: Also update status to 'Done' if progress hits 100
UPDATE "Tasks"
SET progress = COALESCE(computed_progress,0),
    status = CASE
                 WHEN COALESCE(computed_progress,0) >= 100 THEN 'Done'::task_status
                 ELSE status -- Keep existing status (e.g., 'Blocked') if not 100%
             END
WHERE id = v_task_id;

IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS after_activities_change ON "Activities";
CREATE TRIGGER after_activities_change
AFTER INSERT OR UPDATE OR DELETE ON "Activities"
FOR EACH ROW EXECUTE FUNCTION trg_recalc_task_progress();

-- Recalc goal progress from tasks
CREATE OR REPLACE FUNCTION trg_recalc_goal_progress() RETURNS TRIGGER AS $$
DECLARE
v_goal_id INT;
g_weight NUMERIC;
sum_done_task_weight NUMERIC;
sum_task_weights NUMERIC;
computed_goal_progress INT;
BEGIN
IF TG_OP = 'DELETE' THEN
v_goal_id := OLD."goalId";
ELSE
v_goal_id := NEW."goalId";
END IF;

-- Get sum of all task weights under this goal
SELECT COALESCE(SUM(t.weight),0) INTO sum_task_weights FROM "Tasks" t WHERE t."goalId" = v_goal_id;
-- Get weighted sum of task progress
SELECT COALESCE(SUM(CASE WHEN t.progress >= 100 THEN t.weight ELSE t.progress * t.weight / 100 END),0)
INTO sum_done_task_weight FROM "Tasks" t WHERE t."goalId" = v_goal_id;

SELECT g."weight" INTO g_weight FROM "Goals" g WHERE g.id = v_goal_id;

IF g_weight IS NULL OR g_weight = 0 THEN
-- Fallback if goal has no weight: average of task progress
IF sum_task_weights > 0 THEN
computed_goal_progress := LEAST(100, ROUND(sum_done_task_weight / sum_task_weights * 100));
ELSE
-- Fallback if no tasks have weight: simple average
SELECT COALESCE(AVG(t.progress)::int,0) INTO computed_goal_progress FROM "Tasks" t WHERE t."goalId" = v_goal_id;
END IF;
ELSE
-- Standard case: progress is % of total goal weight
computed_goal_progress := LEAST(100, ROUND(sum_done_task_weight / NULLIF(g_weight,0) * 100));
END IF;

-- MODIFIED: Also update status to 'Completed' if progress hits 100
UPDATE "Goals"
SET progress = COALESCE(computed_goal_progress,0),
    status = CASE
                 WHEN COALESCE(computed_goal_progress,0) >= 100 THEN 'Completed'::goal_status
                 ELSE status -- Keep existing status (e.g., 'On Hold') if not 100%
             END
WHERE id = v_goal_id;

IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS after_tasks_change ON "Tasks";
CREATE TRIGGER after_tasks_change
AFTER INSERT OR UPDATE OR DELETE ON "Tasks"
FOR EACH ROW EXECUTE FUNCTION trg_recalc_goal_progress();

-- ... (existing schema code) ...

-- accumulate_metrics: add incoming metrics to activity.currentMetric and clamp by targetMetric.
-- Also compute activity.progress as sum(current)/sum(target) * 100 (if target sums > 0),
-- and write a monthly snapshot into ProgressHistory. Returns the updated currentMetric JSONB.
CREATE OR REPLACE FUNCTION accumulate_metrics(
p_activity_id INT,
p_metrics JSONB,
p_actor_user_id INT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
v_act RECORD;
v_target JSONB;
v_current JSONB;
v_keys TEXT[];
k TEXT;
incoming_val NUMERIC;
cur_val NUMERIC;
tgt_val NUMERIC;
new_val NUMERIC;
updated_json JSONB := '{}'::jsonb;
snap_month DATE := date_trunc('month', now())::date;
sum_current NUMERIC := 0;
sum_target NUMERIC := 0;
key_val NUMERIC;
v_new_progress INT; -- MODIFIED: Declare variables
v_is_done BOOLEAN;
BEGIN
IF p_activity_id IS NULL THEN
RAISE EXCEPTION 'activity id required';
END IF;

-- Lock the activity row for update
SELECT * INTO v_act FROM "Activities" WHERE id = p_activity_id FOR UPDATE;
IF NOT FOUND THEN
RAISE EXCEPTION 'Activity % not found', p_activity_id;
END IF;

v_target := COALESCE(v_act."targetMetric", '{}'::jsonb);
v_current := COALESCE(v_act."currentMetric", '{}'::jsonb);
v_is_done := v_act."isDone"; -- Default to existing value
v_new_progress := v_act.progress; -- Default to existing value

IF p_metrics IS NULL OR p_metrics = '{}'::jsonb THEN
RETURN v_current; -- Nothing to apply
END IF;

-- Get all keys from target, current, and incoming metrics
SELECT array_agg(DISTINCT key) FROM (
SELECT jsonb_object_keys(p_metrics) as key
UNION
SELECT jsonb_object_keys(v_current) as key
UNION
SELECT jsonb_object_keys(v_target) as key
) s INTO v_keys;

IF v_keys IS NULL THEN
v_keys := ARRAY[]::text[];
END IF;

-- Loop each key to calculate new current value
FOREACH k IN ARRAY v_keys LOOP
-- Get incoming value, default null
IF p_metrics ? k THEN
BEGIN
incoming_val := (p_metrics ->> k)::numeric;
EXCEPTION WHEN others THEN
incoming_val := NULL;
END;
ELSE
incoming_val := NULL;
END IF;

-- Get current value, default null
IF v_current ? k THEN
BEGIN
cur_val := (v_current ->> k)::numeric;
EXCEPTION WHEN others THEN
cur_val := NULL;
END;
ELSE
cur_val := NULL;
END IF;

-- Get target value, default null
IF v_target ? k THEN
BEGIN
tgt_val := (v_target ->> k)::numeric;
EXCEPTION WHEN others THEN
tgt_val := NULL;
END;
ELSE
tgt_val := NULL;
END IF;

-- Calculate new value by adding incoming to current
IF incoming_val IS NULL THEN
new_val := COALESCE(cur_val, 0);
ELSE
new_val := COALESCE(cur_val, 0) + incoming_val;
END IF;

-- Clamp new value between 0 and target (if target exists)
IF tgt_val IS NOT NULL THEN
IF new_val > tgt_val THEN
new_val := tgt_val;
END IF;
IF new_val < 0 THEN
new_val := 0;
END IF;
ELSE
IF new_val < 0 THEN
new_val := 0;
END IF;
END IF;

updated_json := jsonb_set(updated_json, ARRAY[k], to_jsonb(new_val), true);
END LOOP;

-- Merge the updated values into the current metric JSON
v_current := (v_current || updated_json);

-- compute sums for progress (only numeric keys)
sum_current := 0;
sum_target := 0;
FOR k IN SELECT jsonb_object_keys(v_current) LOOP
BEGIN
key_val := (v_current ->> k)::numeric;
IF key_val IS NOT NULL THEN sum_current := sum_current + key_val; END IF;
EXCEPTION WHEN others THEN -- ignore non-numeric
END;
END LOOP;
FOR k IN SELECT jsonb_object_keys(v_target) LOOP
BEGIN
key_val := (v_target ->> k)::numeric;
IF key_val IS NOT NULL THEN sum_target := sum_target + key_val; END IF;
EXCEPTION WHEN others THEN -- ignore non-numeric
END;
END LOOP;

-- MODIFIED: Update progress AND isDone flag
IF sum_target IS NOT NULL AND sum_target > 0 THEN
v_new_progress := LEAST(100, ROUND((sum_current / sum_target) * 100));
IF v_new_progress >= 100 THEN
v_is_done := true;
END IF;

UPDATE "Activities"
SET "currentMetric" = v_current,
"progress" = v_new_progress,
"isDone" = v_is_done,
"updatedAt" = NOW()
WHERE id = p_activity_id;
ELSE
-- Only update metrics, don't change progress if target is 0
UPDATE "Activities"
SET "currentMetric" = v_current,
"updatedAt" = NOW()
WHERE id = p_activity_id;
END IF;

-- Write to progress history table for snapshots
INSERT INTO "ProgressHistory"
(entity_type, entity_id, group_id, progress, metrics, recorded_at, snapshot_month)
VALUES
('activity', p_activity_id,
(SELECT gl."groupId" FROM "Activities" a JOIN "Tasks" t ON a."taskId" = t.id JOIN "Goals" gl ON t."goalId" = gl.id WHERE a.id = p_activity_id),
COALESCE(v_new_progress, 0), -- MODIFIED: Use new progress value
v_current, NOW(), snap_month)
ON CONFLICT (entity_type, entity_id, snapshot_month)
DO UPDATE SET metrics = EXCLUDED.metrics, progress = EXCLUDED.progress, recorded_at = NOW();

RETURN v_current;
END;
$$;

-- Done