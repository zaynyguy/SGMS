-- scr/scripts/schema.sql
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

DROP TYPE IF EXISTS goal_status CASCADE;
DROP TYPE IF EXISTS task_status CASCADE;
DROP TYPE IF EXISTS activity_status CASCADE;
DROP TYPE IF EXISTS report_status CASCADE;

-- =========================
-- ENUMS
-- =========================
CREATE TYPE goal_status AS ENUM ('Not Started', 'In Progress', 'Completed', 'On Hold');
CREATE TYPE task_status AS ENUM ('To Do', 'In Progress', 'Done', 'Blocked');
CREATE TYPE activity_status AS ENUM ('To Do', 'In Progress', 'Done');
CREATE TYPE report_status AS ENUM ('Pending', 'Approved', 'Rejected');

-- =========================
-- ROLES & PERMISSIONS
-- =========================
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
  "darkMode" BOOLEAN DEFAULT false,
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

-- =========================
-- GROUPS & MEMBERSHIP
-- =========================
CREATE TABLE "Groups" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(255) NOT NULL UNIQUE,
  "description" TEXT,
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

-- =========================
-- GOALS
-- =========================
CREATE TABLE "Goals" (
  "id" SERIAL PRIMARY KEY,
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
CREATE INDEX idx_goals_group_status ON "Goals" ("groupId","status");

-- =========================
-- TASKS
-- =========================
CREATE TABLE "Tasks" (
  "id" SERIAL PRIMARY KEY,
  "goalId" INTEGER NOT NULL REFERENCES "Goals"("id") ON DELETE CASCADE,
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
CREATE INDEX idx_tasks_goal_id ON "Tasks" ("goalId");
CREATE INDEX idx_tasks_assignee_id ON "Tasks" ("assigneeId");

-- =========================
-- ACTIVITIES
-- =========================
CREATE TABLE "Activities" (
  "id" SERIAL PRIMARY KEY,
  "taskId" INTEGER NOT NULL REFERENCES "Tasks"("id") ON DELETE CASCADE,
  "parentId" INTEGER REFERENCES "Activities"("id") ON DELETE CASCADE,
  "title" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "status" activity_status NOT NULL DEFAULT 'To Do',
  "dueDate" DATE,
  "targetMetric" JSONB DEFAULT '{}'::jsonb,
  "currentMetric" JSONB DEFAULT '{}'::jsonb,
  "weight" NUMERIC NOT NULL DEFAULT 0,
  "isDone" BOOLEAN DEFAULT false,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_activities_task_id ON "Activities" ("taskId");
CREATE INDEX idx_activities_parent_id ON "Activities" ("parentId");

-- =========================
-- SYSTEM SETTINGS
-- =========================
CREATE TABLE "SystemSettings" (
  key VARCHAR(255) PRIMARY KEY,
  value JSONB,
  description TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================
-- REPORTS
-- =========================
CREATE TABLE "Reports" (
  "id" SERIAL PRIMARY KEY,
  "activityId" INT NOT NULL REFERENCES "Activities"(id) ON DELETE CASCADE,
  "userId" INT REFERENCES "Users"(id) ON DELETE SET NULL,
  "narrative" TEXT,
  "metrics_data" JSONB, 
  "new_status" VARCHAR(50),
  "status" report_status NOT NULL DEFAULT 'Pending',
  "adminComment" TEXT,
  "resubmissionDeadline" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_reports_userId ON "Reports" ("userId");
CREATE INDEX idx_reports_activityId ON "Reports" ("activityId");

-- =========================
-- ATTACHMENTS
-- =========================
CREATE TABLE "Attachments" (
  "id" SERIAL PRIMARY KEY,
  "reportId" INT NOT NULL REFERENCES "Reports"(id) ON DELETE CASCADE,
  "fileName" VARCHAR(255) NOT NULL,
  "filePath" TEXT NOT NULL,
  "fileType" VARCHAR(100) NOT NULL,
  "provider" VARCHAR(20) DEFAULT 'local',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_attachments_reportId ON "Attachments" ("reportId");

-- =========================
-- NOTIFICATIONS
-- =========================
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

-- =========================
-- AUDIT LOGS
-- =========================
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

-- =========================
-- PROGRESS HISTROY
-- =========================

CREATE TABLE IF NOT EXISTS "ProgressHistory" (
  id SERIAL PRIMARY KEY,
  entity_type VARCHAR(20) NOT NULL, -- 'Activity' | 'Task' | 'Goal'
  entity_id INTEGER NOT NULL,
  group_id INTEGER,
  progress INTEGER NOT NULL DEFAULT 0,
  metrics JSONB DEFAULT '{}'::jsonb,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_progresshistory_entity ON "ProgressHistory"(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_progresshistory_recorded_at ON "ProgressHistory"(recorded_at);

-- =========================
-- TRIGGERS & FUNCTIONS
-- =========================
CREATE OR REPLACE FUNCTION update_updatedAt_column() RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

-- Attach triggers
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

-- =========================
-- PROGRESS RECALCULATION
-- =========================
-- Task progress from Activities
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
  SELECT COALESCE(SUM(CASE WHEN a."isDone" THEN a.weight ELSE 0 END),0) INTO sum_done_weight FROM "Activities" a WHERE a."taskId" = v_task_id;
  SELECT t."weight" INTO t_weight FROM "Tasks" t WHERE t.id = v_task_id;

  IF t_weight IS NULL OR t_weight = 0 THEN
    IF sum_activity_weights > 0 THEN
      computed_progress := LEAST(100, ROUND(sum_done_weight / sum_activity_weights * 100));
    ELSE
      SELECT COALESCE(AVG(CASE WHEN a."isDone" THEN 100 WHEN a.status='In Progress' THEN 50 ELSE 0 END)::int,0)
      INTO computed_progress FROM "Activities" a WHERE a."taskId" = v_task_id;
    END IF;
  ELSE
    computed_progress := LEAST(100, ROUND(sum_done_weight / NULLIF(t_weight,0) * 100));
  END IF;

  UPDATE "Tasks" SET progress = COALESCE(computed_progress,0) WHERE id = v_task_id;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_activities_change
AFTER INSERT OR UPDATE OR DELETE ON "Activities"
FOR EACH ROW EXECUTE FUNCTION trg_recalc_task_progress();

-- Goal progress from Tasks
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

  SELECT COALESCE(SUM(t.weight),0) INTO sum_task_weights FROM "Tasks" t WHERE t."goalId" = v_goal_id;
  SELECT COALESCE(SUM(CASE WHEN t.progress >= 100 THEN t.weight ELSE t.progress * t.weight / 100 END),0)
  INTO sum_done_task_weight FROM "Tasks" t WHERE t."goalId" = v_goal_id;

  SELECT g."weight" INTO g_weight FROM "Goals" g WHERE g.id = v_goal_id;

  IF g_weight IS NULL OR g_weight = 0 THEN
    IF sum_task_weights > 0 THEN
      computed_goal_progress := LEAST(100, ROUND(sum_done_task_weight / sum_task_weights * 100));
    ELSE
      SELECT COALESCE(AVG(t.progress)::int,0) INTO computed_goal_progress FROM "Tasks" t WHERE t."goalId" = v_goal_id;
    END IF;
  ELSE
    computed_goal_progress := LEAST(100, ROUND(sum_done_task_weight / NULLIF(g_weight,0) * 100));
  END IF;

  UPDATE "Goals" SET progress = COALESCE(computed_goal_progress,0) WHERE id = v_goal_id;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_tasks_change
AFTER INSERT OR UPDATE OR DELETE ON "Tasks"
FOR EACH ROW EXECUTE FUNCTION trg_recalc_goal_progress();
