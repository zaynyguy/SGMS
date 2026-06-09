-- Migration 004: Fix Progress Rollup Triggers to Use Calculated Progress
-- Issue: Previous triggers only looked at isDone/status, not calculated progress from metrics
-- Solution: Update triggers to use weighted average of child progress values

CREATE OR REPLACE FUNCTION trg_recalc_task_progress() RETURNS TRIGGER AS $$
DECLARE
  v_task_id INT;
  computed_progress INT;
BEGIN
  IF TG_OP = 'DELETE' THEN 
    v_task_id := OLD."taskId"; 
  ELSE 
    v_task_id := NEW."taskId"; 
  END IF;

  -- Calculate task progress as weighted average of activity progress values
  SELECT COALESCE(ROUND(SUM(a."progress" * a.weight) / NULLIF(SUM(a.weight), 0))::int, 0)
    INTO computed_progress
  FROM "Activities" a
  WHERE a."taskId" = v_task_id;

  -- If no activities, check if all activities are done (legacy isDone-only approach)
  IF computed_progress = 0 THEN
    SELECT COALESCE(ROUND(AVG(CASE WHEN a."isDone" = true THEN 100 ELSE 0 END))::int, 0)
      INTO computed_progress
    FROM "Activities" a
    WHERE a."taskId" = v_task_id;
  END IF;

  UPDATE "Tasks"
  SET progress = COALESCE(computed_progress, 0),
      status = CASE WHEN COALESCE(computed_progress, 0) >= 100 THEN 'Done'::task_status ELSE status END
  WHERE id = v_task_id;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
DROP TRIGGER IF EXISTS after_activities_change ON "Activities" CASCADE;
CREATE TRIGGER after_activities_change
  AFTER INSERT OR UPDATE OR DELETE ON "Activities"
  FOR EACH ROW EXECUTE FUNCTION trg_recalc_task_progress();

CREATE OR REPLACE FUNCTION trg_recalc_goal_progress() RETURNS TRIGGER AS $$
DECLARE
  v_goal_id INT;
  computed_goal_progress INT;
BEGIN
  IF TG_OP = 'DELETE' THEN 
    v_goal_id := OLD."goalId"; 
  ELSE 
    v_goal_id := NEW."goalId"; 
  END IF;

  -- Calculate goal progress as weighted average of task progress values
  SELECT COALESCE(ROUND(SUM(t."progress" * t.weight) / NULLIF(SUM(t.weight), 0))::int, 0)
    INTO computed_goal_progress
  FROM "Tasks" t
  WHERE t."goalId" = v_goal_id;

  UPDATE "Goals"
  SET progress = COALESCE(computed_goal_progress, 0),
      status = CASE WHEN COALESCE(computed_goal_progress, 0) >= 100 THEN 'Completed'::goal_status ELSE status END
  WHERE id = v_goal_id;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
DROP TRIGGER IF EXISTS after_tasks_change ON "Tasks" CASCADE;
CREATE TRIGGER after_tasks_change
  AFTER INSERT OR UPDATE OR DELETE ON "Tasks"
  FOR EACH ROW EXECUTE FUNCTION trg_recalc_goal_progress();
