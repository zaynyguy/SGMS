-- migration_add_metrics_and_activityrecords.sql
-- Safe, non-destructive migration to add metric_type, metricType column,
-- fiscal helpers, updated accumulate_metrics (4-arg), activityrecords indexes/triggers.
-- Always BACKUP before running:
--   pg_dump -Fc --no-owner --no-privileges -f backup_before_migration.dump "postgres://user:pass@host:port/db"

-- 0. Make sure we run in public schema
SET search_path = public;

-- 1. Create metric_type enum if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'metric_type') THEN
    CREATE TYPE metric_type AS ENUM ('Plus', 'Minus', 'Increase', 'Decrease', 'Maintain');
  END IF;
END$$;

-- 2. Add metricType column to Activities if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Activities' AND column_name = 'metricType'
  ) THEN
    ALTER TABLE "Activities" ADD COLUMN "metricType" metric_type DEFAULT 'Plus';
  END IF;
END$$;

-- 3. Ensure update_updatedAt_column function exists (create or replace is safe)
CREATE OR REPLACE FUNCTION update_updatedAt_column() RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Ensure ActivityRecords table exists (should already exist in your DB, this is non-destructive)
CREATE TABLE IF NOT EXISTS "ActivityRecords" (
  id SERIAL PRIMARY KEY,
  "activityId" INTEGER NOT NULL,
  "fiscalYear" INTEGER NOT NULL,
  quarter integer,
  month integer,
  "metricKey" character varying(255) NOT NULL,
  value numeric,
  source character varying(50) DEFAULT 'report',
  "reportId" integer,
  "createdBy" integer,
  "updatedBy" integer,
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
  "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "ActivityRecords_month_check" CHECK (((month IS NULL) OR ((month >= 1) AND (month <= 12)))),
  CONSTRAINT "ActivityRecords_quarter_check" CHECK (((quarter IS NULL) OR ((quarter >= 1) AND (quarter <= 4))))
);

-- 5. Ensure the unique indexes used by new logic exist (non-destructive)
CREATE UNIQUE INDEX IF NOT EXISTS ux_activityrecords_quarterly
  ON "ActivityRecords"("activityId", "fiscalYear", "quarter", "metricKey")
  WHERE "quarter" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_activityrecords_monthly
  ON "ActivityRecords"("activityId", "fiscalYear", "month", "metricKey")
  WHERE "month" IS NOT NULL AND "quarter" IS NULL;

CREATE INDEX IF NOT EXISTS idx_activityrecords_activity ON "ActivityRecords"("activityId");
CREATE INDEX IF NOT EXISTS idx_activityrecords_fiscalyear ON "ActivityRecords"("fiscalYear");
CREATE INDEX IF NOT EXISTS idx_activityrecords_quarter ON "ActivityRecords"(quarter);

-- 6. Create trigger to update updatedAt on ActivityRecords if not present
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updatedAt_ActivityRecords') THEN
    CREATE TRIGGER set_updatedAt_ActivityRecords
      BEFORE UPDATE ON "ActivityRecords"
      FOR EACH ROW
      EXECUTE FUNCTION update_updatedAt_column();
  END IF;
END$$;

-- 7. Fiscal helper functions (create or replace)
CREATE OR REPLACE FUNCTION get_fiscal_year_start_month() RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
    v_month INT;
BEGIN
    SELECT (value::text)::int INTO v_month
    FROM "SystemSettings"
    WHERE key = 'fiscal_year_start_month'
    LIMIT 1;

    RETURN COALESCE(v_month, 7);
END;
$$;

CREATE OR REPLACE FUNCTION calc_fiscal_period(p_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE(fiscal_year INT, quarter INT, cal_month INT) LANGUAGE plpgsql AS $$
DECLARE
    v_start_month INT;
    v_cal_month INT;
    v_cal_year INT;
    v_fiscal_month INT;
BEGIN
    v_start_month := get_fiscal_year_start_month();
    v_cal_month := EXTRACT(MONTH FROM p_date)::INT;
    v_cal_year := EXTRACT(YEAR FROM p_date)::INT;

    IF v_cal_month >= v_start_month THEN
        fiscal_year := v_cal_year + 1;
        v_fiscal_month := v_cal_month - v_start_month + 1;
    ELSE
        fiscal_year := v_cal_year;
        v_fiscal_month := v_cal_month + (12 - v_start_month + 1);
    END IF;

    quarter := CEIL(v_fiscal_month / 3.0)::INT;
    cal_month := v_cal_month;
    RETURN NEXT;
END;
$$;

-- 8. Replace old accumulate_metrics function signatures and install the new function (4 args)
-- Drop old variants if they exist (safe, non-destructive to table data)
DROP FUNCTION IF EXISTS accumulate_metrics(INT, JSONB, INT);
DROP FUNCTION IF EXISTS accumulate_metrics(INT, JSONB);

-- Create the NEW accumulate_metrics with the 4-arg signature:
CREATE OR REPLACE FUNCTION accumulate_metrics(
    p_activity_id INT,
    p_metrics JSONB,
    p_actor_user_id INT DEFAULT NULL,
    p_report_id INT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
    v_act RECORD;
    v_target JSONB;
    v_current JSONB;
    v_prev JSONB;
    v_metric_type metric_type;
    k TEXT;

    sum_current NUMERIC := 0;
    sum_target NUMERIC := 0;

    val_current NUMERIC;
    val_target NUMERIC;
    val_prev NUMERIC;

    key_val NUMERIC;
    v_new_progress INT := 0;
    snap_month DATE := date_trunc('month', now())::date;

    v_fiscal RECORD;
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
    v_prev   := COALESCE(v_act."previousMetric", '{}'::jsonb);
    v_current := COALESCE(v_act."currentMetric", '{}'::jsonb);
    v_metric_type := COALESCE(v_act."metricType", 'Plus');

    IF v_metric_type = 'Plus' OR v_metric_type = 'Minus' THEN

        FOR k IN SELECT jsonb_object_keys(p_metrics) LOOP
            BEGIN
                key_val := (p_metrics ->> k)::numeric;
                IF key_val IS NOT NULL THEN
                    val_current := COALESCE((v_current ->> k)::numeric, 0);
                    v_current := jsonb_set(v_current, ARRAY[k], to_jsonb(val_current + key_val));
                END IF;
            EXCEPTION WHEN others THEN END;
        END LOOP;

        sum_current := 0;
        sum_target := 0;

        FOR k IN SELECT jsonb_object_keys(v_current) LOOP
            val_current := (v_current ->> k)::numeric;
            sum_current := sum_current + COALESCE(val_current, 0);
        END LOOP;

        FOR k IN SELECT jsonb_object_keys(v_target) LOOP
            val_target := (v_target ->> k)::numeric;
            sum_target := sum_target + COALESCE(val_target, 0);
        END LOOP;

        IF sum_target > 0 THEN
            v_new_progress := LEAST(100, ROUND((sum_current / sum_target) * 100));
        ELSE
            v_new_progress := 0;
        END IF;

    ELSIF v_metric_type = 'Increase' THEN

        v_current := p_metrics; 

        sum_current := 0;
        sum_target := 0;
        val_prev := 0;

        FOR k IN SELECT jsonb_object_keys(v_current) LOOP
            sum_current := sum_current + COALESCE((v_current ->> k)::numeric, 0);
        END LOOP;
        
        FOR k IN SELECT jsonb_object_keys(v_target) LOOP
            sum_target := sum_target + COALESCE((v_target ->> k)::numeric, 0);
        END LOOP;
        
        FOR k IN SELECT jsonb_object_keys(v_prev) LOOP
            val_prev := val_prev + COALESCE((v_prev ->> k)::numeric, 0);
        END LOOP;

        IF (sum_target - val_prev) > 0 THEN
            v_new_progress := LEAST(100, ROUND( ((sum_current - val_prev) / (sum_target - val_prev)) * 100 ));
            v_new_progress := GREATEST(0, v_new_progress);
        ELSE
            v_new_progress := 100;
        END IF;

    ELSIF v_metric_type = 'Decrease' THEN

        v_current := p_metrics;

        sum_current := 0;
        sum_target := 0;
        val_prev := 0;

        FOR k IN SELECT jsonb_object_keys(v_current) LOOP
            sum_current := sum_current + COALESCE((v_current ->> k)::numeric, 0);
        END LOOP;
        FOR k IN SELECT jsonb_object_keys(v_target) LOOP
            sum_target := sum_target + COALESCE((v_target ->> k)::numeric, 0);
        END LOOP;
        FOR k IN SELECT jsonb_object_keys(v_prev) LOOP
            val_prev := val_prev + COALESCE((v_prev ->> k)::numeric, 0);
        END LOOP;

        IF (val_prev - sum_target) > 0 THEN
            v_new_progress := LEAST(100, ROUND( ((val_prev - sum_current) / (val_prev - sum_target)) * 100 ));
            v_new_progress := GREATEST(0, v_new_progress);
        ELSE
            v_new_progress := 100;
        END IF;

    ELSIF v_metric_type = 'Maintain' THEN

        v_current := p_metrics;
        v_new_progress := 100;
    END IF;

    UPDATE "Activities"
    SET "currentMetric" = v_current,
        "progress" = v_new_progress,
        "updatedAt" = NOW()
    WHERE id = p_activity_id;

    -- Insert into ProgressHistory
    INSERT INTO "ProgressHistory"
    (entity_type, entity_id, group_id, progress, metrics, recorded_at, snapshot_month)
    VALUES
    ('Activity', p_activity_id,
     (SELECT gl."groupId" FROM "Activities" a JOIN "Tasks" t ON a."taskId" = t.id JOIN "Goals" gl ON t."goalId" = gl.id WHERE a.id = p_activity_id),
     COALESCE(v_new_progress, 0),
     v_current, NOW(), snap_month)
    ON CONFLICT (entity_type, entity_id, snapshot_month)
    DO UPDATE SET metrics = EXCLUDED.metrics, progress = EXCLUDED.progress, recorded_at = NOW();

    -- Fiscal period and write to ActivityRecords (quarterly + monthly)
    SELECT * INTO v_fiscal FROM calc_fiscal_period(CURRENT_DATE);

    FOR k IN SELECT jsonb_object_keys(p_metrics) LOOP
      BEGIN
        key_val := (p_metrics ->> k)::numeric;
        IF key_val IS NOT NULL THEN
          -- quarterly upsert
          INSERT INTO "ActivityRecords"
            ("activityId", "fiscalYear", "quarter", "month", "metricKey", "value", "source", "reportId", "createdBy", "updatedBy")
          VALUES
            (p_activity_id, v_fiscal.fiscal_year, v_fiscal.quarter, NULL, k,
             CASE WHEN v_metric_type IN ('Plus','Minus') THEN
                   COALESCE((SELECT "value" FROM "ActivityRecords" WHERE "activityId" = p_activity_id AND "fiscalYear" = v_fiscal.fiscal_year AND "quarter" = v_fiscal.quarter AND "metricKey" = k), 0) + key_val
                  ELSE key_val END,
             'report', p_report_id, p_actor_user_id, p_actor_user_id)
          ON CONFLICT ("activityId", "fiscalYear", "quarter", "metricKey")
          WHERE "quarter" IS NOT NULL
          DO UPDATE SET
            "value" = CASE WHEN v_metric_type IN ('Plus','Minus') THEN COALESCE("ActivityRecords"."value",0) + key_val ELSE key_val END,
            "source" = 'report',
            "reportId" = p_report_id,
            "updatedBy" = p_actor_user_id,
            "updatedAt" = NOW();

          -- monthly upsert
          INSERT INTO "ActivityRecords"
            ("activityId", "fiscalYear", "quarter", "month", "metricKey", "value", "source", "reportId", "createdBy", "updatedBy")
          VALUES
            (p_activity_id, v_fiscal.fiscal_year, NULL, v_fiscal.cal_month, k,
             CASE WHEN v_metric_type IN ('Plus','Minus') THEN
                   COALESCE((SELECT "value" FROM "ActivityRecords" WHERE "activityId" = p_activity_id AND "fiscalYear" = v_fiscal.fiscal_year AND "month" = v_fiscal.cal_month AND "quarter" IS NULL AND "metricKey" = k), 0) + key_val
                  ELSE key_val END,
             'report', p_report_id, p_actor_user_id, p_actor_user_id)
          ON CONFLICT ("activityId", "fiscalYear", "month", "metricKey")
          WHERE "month" IS NOT NULL AND "quarter" IS NULL
          DO UPDATE SET
            "value" = CASE WHEN v_metric_type IN ('Plus','Minus') THEN COALESCE("ActivityRecords"."value",0) + key_val ELSE key_val END,
            "source" = 'report',
            "reportId" = p_report_id,
            "updatedBy" = p_actor_user_id,
            "updatedAt" = NOW();
        END IF;
      EXCEPTION WHEN others THEN
        RAISE NOTICE 'accumulate_metrics: activity % key % - %', p_activity_id, k, SQLERRM;
      END;
    END LOOP;

    RETURN v_current;
END;
$$;

-- 9. Recreate/ensure rollNo assignment triggers and progress triggers exist
-- trg_assign_task_rollno (for Tasks)
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

-- trg_assign_activity_rollno (for Activities)
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

-- trg_recalc_task_progress
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

-- trg_recalc_goal_progress
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

-- 10. If your app calls accumulate_metrics with only (activityId, metrics, userId),
-- you will now need to pass the reportId as 4th arg (can be NULL). Keep backward compatibility
-- by creating a wrapper function if desired (optional). Example wrapper:
DROP FUNCTION IF EXISTS accumulate_metrics_wrapper(INT, JSONB, INT);
CREATE FUNCTION accumulate_metrics_wrapper(p_activity_id INT, p_metrics JSONB, p_actor_user_id INT)
  RETURNS JSONB LANGUAGE sql AS $$
    SELECT accumulate_metrics(p_activity_id, p_metrics, p_actor_user_id, NULL);
$$;

-- End of migration
