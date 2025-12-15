-- ./docker/initdb/01_schema.sql
-- Idempotent schema initialization for SGMS (safe for re-run)



SET client_min_messages TO WARNING;
SET search_path = public;

-- safe type creation (modern Postgres supports IF NOT EXISTS)
-- Safe enum creation (works on all Postgres versions)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'goal_status') THEN
    CREATE TYPE goal_status AS ENUM ('Not Started', 'In Progress', 'Completed', 'On Hold');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_status') THEN
    CREATE TYPE task_status AS ENUM ('To Do', 'In Progress', 'Done', 'Blocked');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'activity_status') THEN
    CREATE TYPE activity_status AS ENUM ('To Do', 'In Progress', 'Done');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_status') THEN
    CREATE TYPE report_status AS ENUM ('Pending', 'Approved', 'Rejected');
  END IF;
END$$;


-- Roles & permissions
CREATE TABLE IF NOT EXISTS "Roles" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(255) NOT NULL UNIQUE,
  "description" VARCHAR(255),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Permissions" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(255) NOT NULL UNIQUE,
  "description" VARCHAR(255),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Users" (
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

CREATE TABLE IF NOT EXISTS "RolePermissions" (
  "id" SERIAL PRIMARY KEY,
  "roleId" INTEGER NOT NULL REFERENCES "Roles"("id") ON DELETE CASCADE,
  "permissionId" INTEGER NOT NULL REFERENCES "Permissions"("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("roleId","permissionId")
);

CREATE TABLE IF NOT EXISTS "Groups" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(255) NOT NULL UNIQUE,
  "description" TEXT,
  "profilePicture" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "UserGroups" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL REFERENCES "Users"("id") ON DELETE CASCADE,
  "groupId" INTEGER NOT NULL REFERENCES "Groups"("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("userId","groupId")
);

CREATE SEQUENCE IF NOT EXISTS goals_rollno_seq START 1;

CREATE TABLE IF NOT EXISTS "Goals" (
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
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_goals_rollno_positive'
  ) THEN
    ALTER TABLE "Goals" ADD CONSTRAINT chk_goals_rollno_positive CHECK ("rollNo" > 0);
  END IF;
EXCEPTION WHEN duplicate_object THEN
  -- ignore
END$$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_goals_rollno ON "Goals" ("rollNo");
CREATE INDEX IF NOT EXISTS idx_goals_group_status ON "Goals" ("groupId","status");

CREATE TABLE IF NOT EXISTS "Tasks" (
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
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_tasks_rollno_positive'
  ) THEN
    ALTER TABLE "Tasks" ADD CONSTRAINT chk_tasks_rollno_positive CHECK ("rollNo" IS NULL OR "rollNo" > 0);
  END IF;
EXCEPTION WHEN duplicate_object THEN
END$$;
CREATE UNIQUE INDEX IF NOT EXISTS ux_tasks_goal_roll ON "Tasks" ("goalId","rollNo");
CREATE INDEX IF NOT EXISTS idx_tasks_goal_id ON "Tasks" ("goalId");
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON "Tasks" ("assigneeId");

CREATE TABLE IF NOT EXISTS "Activities" (
  "id" SERIAL PRIMARY KEY,
  "taskId" INTEGER NOT NULL REFERENCES "Tasks"("id") ON DELETE CASCADE,
  "parentId" INTEGER REFERENCES "Activities"("id") ON DELETE CASCADE,
  "rollNo" INTEGER,
  "title" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "status" activity_status NOT NULL DEFAULT 'To Do',
  "dueDate" DATE,
  "previousMetric" JSONB DEFAULT '{}'::jsonb,
  "targetMetric" JSONB DEFAULT '{}'::jsonb,
  "currentMetric" JSONB DEFAULT '{}'::jsonb,
  "quarterlyGoals" JSONB DEFAULT '{}'::jsonb,
  "progress" INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  "weight" NUMERIC NOT NULL DEFAULT 0,
  "isDone" BOOLEAN DEFAULT false,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_activities_rollno_positive'
  ) THEN
    ALTER TABLE "Activities" ADD CONSTRAINT chk_activities_rollno_positive CHECK ("rollNo" IS NULL OR "rollNo" > 0);
  END IF;
EXCEPTION WHEN duplicate_object THEN
END$$;
CREATE UNIQUE INDEX IF NOT EXISTS ux_activities_task_roll ON "Activities" ("taskId","rollNo");
CREATE INDEX IF NOT EXISTS idx_activities_task_id ON "Activities" ("taskId");
CREATE INDEX IF NOT EXISTS idx_activities_parent_id ON "Activities" ("parentId");

CREATE TABLE IF NOT EXISTS "SystemSettings" (
  key VARCHAR(255) PRIMARY KEY,
  value JSONB,
  description TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Reports" (
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
CREATE INDEX IF NOT EXISTS idx_reports_userId ON "Reports" ("userId");
CREATE INDEX IF NOT EXISTS idx_reports_activityId ON "Reports" ("activityId");
CREATE INDEX IF NOT EXISTS idx_reports_applied ON "Reports" ("applied");

CREATE TABLE IF NOT EXISTS "Attachments" (
  "id" SERIAL PRIMARY KEY,
  "reportId" INT NOT NULL REFERENCES "Reports"(id) ON DELETE CASCADE,
  "publicId" VARCHAR(255),
  "fileName" VARCHAR(255) NOT NULL,
  "filePath" TEXT NOT NULL,
  "fileType" VARCHAR(100) NOT NULL,
  "provider" VARCHAR(20) DEFAULT 'local',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_attachments_reportId ON "Attachments" ("reportId");

CREATE TABLE IF NOT EXISTS "Notifications" (
  "id" SERIAL PRIMARY KEY,
  "userId" INT NOT NULL REFERENCES "Users"("id") ON DELETE CASCADE,
  "type" VARCHAR(50) NOT NULL,
  "message" TEXT NOT NULL,
  "meta" JSONB DEFAULT '{}'::jsonb,
  "level" VARCHAR(20) DEFAULT 'info',
  "isRead" BOOLEAN DEFAULT false,
  "createdAt" TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_userid_createdAt ON "Notifications" ("userId","createdAt");

CREATE TABLE IF NOT EXISTS "AuditLogs" (
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
CREATE INDEX IF NOT EXISTS idx_auditlogs_createdAt ON "AuditLogs" ("createdAt");

CREATE TABLE IF NOT EXISTS "RefreshTokens" (
  id SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL REFERENCES "Users"(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  revoked BOOLEAN DEFAULT false,
  createdAt TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_userid ON "RefreshTokens"("userId");

CREATE TABLE IF NOT EXISTS "ProgressHistory" (
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

-- Update trigger helper
CREATE OR REPLACE FUNCTION update_updatedAt_column() RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updatedAt_Roles') THEN
    CREATE TRIGGER set_updatedAt_Roles BEFORE UPDATE ON "Roles" FOR EACH ROW EXECUTE FUNCTION update_updatedAt_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updatedAt_Permissions') THEN
    CREATE TRIGGER set_updatedAt_Permissions BEFORE UPDATE ON "Permissions" FOR EACH ROW EXECUTE FUNCTION update_updatedAt_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updatedAt_Users') THEN
    CREATE TRIGGER set_updatedAt_Users BEFORE UPDATE ON "Users" FOR EACH ROW EXECUTE FUNCTION update_updatedAt_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updatedAt_RolePermissions') THEN
    CREATE TRIGGER set_updatedAt_RolePermissions BEFORE UPDATE ON "RolePermissions" FOR EACH ROW EXECUTE FUNCTION update_updatedAt_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updatedAt_Groups') THEN
    CREATE TRIGGER set_updatedAt_Groups BEFORE UPDATE ON "Groups" FOR EACH ROW EXECUTE FUNCTION update_updatedAt_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updatedAt_UserGroups') THEN
    CREATE TRIGGER set_updatedAt_UserGroups BEFORE UPDATE ON "UserGroups" FOR EACH ROW EXECUTE FUNCTION update_updatedAt_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updatedAt_Goals') THEN
    CREATE TRIGGER set_updatedAt_Goals BEFORE UPDATE ON "Goals" FOR EACH ROW EXECUTE FUNCTION update_updatedAt_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updatedAt_Tasks') THEN
    CREATE TRIGGER set_updatedAt_Tasks BEFORE UPDATE ON "Tasks" FOR EACH ROW EXECUTE FUNCTION update_updatedAt_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updatedAt_Activities') THEN
    CREATE TRIGGER set_updatedAt_Activities BEFORE UPDATE ON "Activities" FOR EACH ROW EXECUTE FUNCTION update_updatedAt_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updatedAt_SystemSettings') THEN
    CREATE TRIGGER set_updatedAt_SystemSettings BEFORE UPDATE ON "SystemSettings" FOR EACH ROW EXECUTE FUNCTION update_updatedAt_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updatedAt_Reports') THEN
    CREATE TRIGGER set_updatedAt_Reports BEFORE UPDATE ON "Reports" FOR EACH ROW EXECUTE FUNCTION update_updatedAt_column();
  END IF;
END$$;

-- Triggers and functions for roll numbers and progress recalculation
CREATE OR REPLACE FUNCTION trg_assign_task_rollno() RETURNS TRIGGER AS $$
DECLARE v_max INT;
BEGIN
  IF NEW."rollNo" IS NOT NULL THEN
    IF NEW."rollNo" <= 0 THEN RAISE EXCEPTION 'task rollNo must be > 0'; END IF;
    RETURN NEW;
  END IF;
  SELECT COALESCE(MAX("rollNo"), 0) + 1 INTO v_max FROM "Tasks" WHERE "goalId" = NEW."goalId";
  NEW."rollNo" := v_max;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS before_tasks_insert_assign_rollno ON "Tasks" CASCADE;
CREATE TRIGGER before_tasks_insert_assign_rollno
  BEFORE INSERT ON "Tasks"
  FOR EACH ROW
  EXECUTE FUNCTION trg_assign_task_rollno();

CREATE OR REPLACE FUNCTION trg_assign_activity_rollno() RETURNS TRIGGER AS $$
DECLARE v_max INT;
BEGIN
  IF NEW."rollNo" IS NOT NULL THEN
    IF NEW."rollNo" <= 0 THEN RAISE EXCEPTION 'activity rollNo must be > 0'; END IF;
    RETURN NEW;
  END IF;
  SELECT COALESCE(MAX("rollNo"), 0) + 1 INTO v_max FROM "Activities" WHERE "taskId" = NEW."taskId";
  NEW."rollNo" := v_max;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS before_activities_insert_assign_rollno ON "Activities" CASCADE;
CREATE TRIGGER before_activities_insert_assign_rollno
  BEFORE INSERT ON "Activities"
  FOR EACH ROW
  EXECUTE FUNCTION trg_assign_activity_rollno();

CREATE OR REPLACE FUNCTION trg_recalc_task_progress() RETURNS TRIGGER AS $$
DECLARE
  v_task_id INT;
  sum_done_weight NUMERIC;
  sum_activity_weights NUMERIC;
  computed_progress INT;
BEGIN
  IF TG_OP = 'DELETE' THEN v_task_id := OLD."taskId"; ELSE v_task_id := NEW."taskId"; END IF;

  SELECT COALESCE(SUM(a.weight),0) INTO sum_activity_weights FROM "Activities" a WHERE a."taskId" = v_task_id;
  SELECT COALESCE(SUM(CASE WHEN a."isDone" = true THEN a.weight ELSE 0 END),0)
    INTO sum_done_weight FROM "Activities" a WHERE a."taskId" = v_task_id;

  IF sum_activity_weights > 0 THEN
    computed_progress := LEAST(100, ROUND(sum_done_weight / NULLIF(sum_activity_weights,0) * 100));
  ELSE
    SELECT COALESCE(ROUND(AVG(CASE WHEN a."isDone" = true THEN 100 ELSE 0 END))::int, 0)
      INTO computed_progress FROM "Activities" a WHERE a."taskId" = v_task_id;
  END IF;

  UPDATE "Tasks"
  SET progress = COALESCE(computed_progress,0),
      status = CASE WHEN COALESCE(computed_progress,0) >= 100 THEN 'Done'::task_status ELSE status END
  WHERE id = v_task_id;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS after_activities_change ON "Activities" CASCADE;
CREATE TRIGGER after_activities_change
  AFTER INSERT OR UPDATE OR DELETE ON "Activities"
  FOR EACH ROW EXECUTE FUNCTION trg_recalc_task_progress();

CREATE OR REPLACE FUNCTION trg_recalc_goal_progress() RETURNS TRIGGER AS $$
DECLARE
  v_goal_id INT;
  g_weight NUMERIC;
  sum_done_task_weight NUMERIC;
  sum_task_weights NUMERIC;
  computed_goal_progress INT;
  total_tasks INT;
  done_tasks INT;
BEGIN
  IF TG_OP = 'DELETE' THEN v_goal_id := OLD."goalId"; ELSE v_goal_id := NEW."goalId"; END IF;

  SELECT COALESCE(SUM(t.weight),0) INTO sum_task_weights FROM "Tasks" t WHERE t."goalId" = v_goal_id;
  SELECT COALESCE(SUM(t.weight),0) INTO sum_done_task_weight FROM "Tasks" t WHERE t."goalId" = v_goal_id AND t.status = 'Done';
  SELECT g."weight" INTO g_weight FROM "Goals" g WHERE g.id = v_goal_id;

  IF g_weight IS NULL OR g_weight = 0 THEN
    IF sum_task_weights > 0 THEN
      computed_goal_progress := LEAST(100, ROUND(sum_done_task_weight / NULLIF(sum_task_weights,0) * 100));
    ELSE
      SELECT COUNT(*) INTO total_tasks FROM "Tasks" t WHERE t."goalId" = v_goal_id;
      SELECT COUNT(*) INTO done_tasks FROM "Tasks" t WHERE t."goalId" = v_goal_id AND t.status = 'Done';
      IF total_tasks > 0 THEN
        computed_goal_progress := LEAST(100, ROUND(done_tasks::numeric / total_tasks::numeric * 100));
      ELSE
        computed_goal_progress := 0;
      END IF;
    END IF;
  ELSE
    computed_goal_progress := LEAST(100, ROUND(sum_done_task_weight / NULLIF(g_weight,0) * 100));
  END IF;

  UPDATE "Goals"
  SET progress = COALESCE(computed_goal_progress,0),
      status = CASE WHEN COALESCE(computed_goal_progress,0) >= 100 THEN 'Completed'::goal_status ELSE status END
  WHERE id = v_goal_id;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS after_tasks_change ON "Tasks" CASCADE;
CREATE TRIGGER after_tasks_change
  AFTER INSERT OR UPDATE OR DELETE ON "Tasks"
  FOR EACH ROW EXECUTE FUNCTION trg_recalc_goal_progress();

-- accumulate_metrics and sp_SubmitReport (kept as-is, idempotent via CREATE OR REPLACE)
CREATE OR REPLACE FUNCTION accumulate_metrics(
  p_activity_id INT,
  p_metrics JSONB,
  p_actor_user_id INT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  v_act RECORD;
  v_target JSONB;
  v_current JSONB;
  k TEXT;
  sum_current NUMERIC := 0;
  sum_target NUMERIC := 0;
  key_val NUMERIC;
  v_new_progress INT := 0;
  snap_month DATE := date_trunc('month', now())::date;
BEGIN
  IF p_activity_id IS NULL THEN
    RAISE EXCEPTION 'activity id required';
  END IF;

  SELECT * INTO v_act FROM "Activities" WHERE id = p_activity_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Activity % not found', p_activity_id; END IF;

  IF p_metrics IS NULL OR p_metrics = '{}'::jsonb THEN
    RETURN COALESCE(v_act."currentMetric", '{}'::jsonb);
  END IF;

  v_target := COALESCE(v_act."targetMetric", '{}'::jsonb);
  v_current := p_metrics;

  FOR k IN SELECT jsonb_object_keys(v_current) LOOP
    BEGIN
      key_val := (v_current ->> k)::numeric;
      IF key_val IS NOT NULL THEN sum_current := sum_current + key_val; END IF;
    EXCEPTION WHEN others THEN END;
  END LOOP;

  FOR k IN SELECT jsonb_object_keys(v_target) LOOP
    BEGIN
      key_val := (v_target ->> k)::numeric;
      IF key_val IS NOT NULL THEN sum_target := sum_target + key_val; END IF;
    EXCEPTION WHEN others THEN END;
  END LOOP;

  IF sum_target IS NOT NULL AND sum_target > 0 THEN
    v_new_progress := LEAST(100, ROUND((sum_current / sum_target) * 100));
    UPDATE "Activities"
    SET "currentMetric" = v_current,
        "progress" = v_new_progress,
        "updatedAt" = NOW()
    WHERE id = p_activity_id;
  ELSE
    UPDATE "Activities"
    SET "currentMetric" = v_current,
        "updatedAt" = NOW()
    WHERE id = p_activity_id;
  END IF;

  INSERT INTO "ProgressHistory"
    (entity_type, entity_id, group_id, progress, metrics, recorded_at, snapshot_month)
  VALUES
    ('Activity', p_activity_id,
     (SELECT gl."groupId" FROM "Activities" a JOIN "Tasks" t ON a."taskId" = t.id JOIN "Goals" gl ON t."goalId" = gl.id WHERE a.id = p_activity_id),
     COALESCE(v_new_progress, 0),
     v_current, NOW(), snap_month)
  ON CONFLICT (entity_type, entity_id, snapshot_month)
  DO UPDATE SET metrics = EXCLUDED.metrics, progress = EXCLUDED.progress, recorded_at = NOW();

  RETURN v_current;
END;
$$;

CREATE OR REPLACE FUNCTION sp_SubmitReport(
    p_activity_id INT,
    p_user_id INT,
    p_narrative TEXT,
    p_metrics_data JSONB,
    p_new_status VARCHAR(50)
) RETURNS INT AS $$
DECLARE
    v_report_id INT;
    v_final_status VARCHAR(50);
    v_is_done BOOLEAN;
    v_current_status VARCHAR(50);
BEGIN
    INSERT INTO "Reports" ("activityId", "userId", "narrative", "metrics_data", "new_status")
    VALUES (p_activity_id, p_user_id, p_narrative, p_metrics_data, p_new_status)
    RETURNING "id" INTO v_report_id;

    SELECT "status" INTO v_current_status FROM "Activities" WHERE "id" = p_activity_id;

    IF p_new_status IS NOT NULL AND p_new_status <> '' THEN
        v_final_status := p_new_status;
    ELSE
        v_final_status := v_current_status;
    END IF;

    IF v_final_status IS NOT NULL AND (v_final_status = 'Done' OR v_final_status = 'Completed') THEN
        v_is_done := TRUE;
    ELSE
        v_is_done := FALSE;
    END IF;

    UPDATE "Activities"
    SET
        "currentMetric" = p_metrics_data,
        "status" = v_final_status,
        "isDone" = v_is_done,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = p_activity_id;

    RETURN v_report_id;
END;
$$ LANGUAGE plpgsql;
