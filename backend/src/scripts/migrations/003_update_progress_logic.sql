-- Migration: Enhanced Progress Logic for Metric Types and Completion Override
-- Description: Implements correct progress calculation for Plus, Minus, Increase, Decrease, Maintain metrics
--              and handles isDone completion override (100% progress when marked complete)

-- Enhanced accumulate_metrics function with better metric type handling
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
    sum_prev NUMERIC := 0;

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

    -- If isDone is true, progress is always 100% (completion override)
    IF v_act."isDone" = TRUE THEN
        v_new_progress := 100;
        UPDATE "Activities"
        SET "progress" = v_new_progress,
            "updatedAt" = NOW()
        WHERE id = p_activity_id;
        RETURN COALESCE(v_act."currentMetric", '{}'::jsonb);
    END IF;

    IF p_metrics IS NULL OR p_metrics = '{}'::jsonb THEN
        RETURN COALESCE(v_act."currentMetric", '{}'::jsonb);
    END IF;

    v_target := COALESCE(v_act."targetMetric", '{}'::jsonb);
    v_prev   := COALESCE(v_act."previousMetric", '{}'::jsonb);
    v_current := COALESCE(v_act."currentMetric", '{}'::jsonb);
    v_metric_type := COALESCE(v_act."metricType", 'Plus');

    -- ===== Plus: Cumulative metric, higher is better =====
    -- Current accumulates from baseline, measured against target total
    IF v_metric_type = 'Plus' THEN

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

    -- ===== Minus: Cumulative reduction metric, lower is better =====
    -- Track reductions toward a target, similar to Plus but inverted goal orientation
    ELSIF v_metric_type = 'Minus' THEN

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

        -- For Minus, progress is measured as |sum_current| / |sum_target|
        IF sum_target != 0 THEN
            v_new_progress := LEAST(100, ROUND((ABS(sum_current) / ABS(sum_target)) * 100));
        ELSE
            v_new_progress := 0;
        END IF;

    -- ===== Increase: Snapshot metric, higher is better =====
    -- Progress from previous year's baseline + target increase
    ELSIF v_metric_type = 'Increase' THEN

        v_current := p_metrics;

        sum_current := 0;
        sum_target := 0;
        sum_prev := 0;

        FOR k IN SELECT jsonb_object_keys(v_current) LOOP
            sum_current := sum_current + COALESCE((v_current ->> k)::numeric, 0);
        END LOOP;

        FOR k IN SELECT jsonb_object_keys(v_target) LOOP
            sum_target := sum_target + COALESCE((v_target ->> k)::numeric, 0);
        END LOOP;

        FOR k IN SELECT jsonb_object_keys(v_prev) LOOP
            sum_prev := sum_prev + COALESCE((v_prev ->> k)::numeric, 0);
        END LOOP;

        -- Target is Previous + Increase
        -- Progress = (Current - Previous) / (Previous + Target - Previous) = (Current - Previous) / Target
        IF sum_target > 0 THEN
            v_new_progress := LEAST(100, ROUND(((sum_current - sum_prev) / sum_target) * 100));
            v_new_progress := GREATEST(0, v_new_progress);
        ELSE
            v_new_progress := CASE WHEN sum_current > sum_prev THEN 100 ELSE 0 END;
        END IF;

    -- ===== Decrease: Snapshot metric, lower is better =====
    -- Progress from previous year's baseline - target decrease (e.g., crime rates)
    ELSIF v_metric_type = 'Decrease' THEN

        v_current := p_metrics;

        sum_current := 0;
        sum_target := 0;
        sum_prev := 0;

        FOR k IN SELECT jsonb_object_keys(v_current) LOOP
            sum_current := sum_current + COALESCE((v_current ->> k)::numeric, 0);
        END LOOP;

        FOR k IN SELECT jsonb_object_keys(v_target) LOOP
            sum_target := sum_target + COALESCE((v_target ->> k)::numeric, 0);
        END LOOP;

        FOR k IN SELECT jsonb_object_keys(v_prev) LOOP
            sum_prev := sum_prev + COALESCE((v_prev ->> k)::numeric, 0);
        END LOOP;

        -- Target is Previous - Decrease (e.g., crime rate went down by target amount)
        -- Progress = (Previous - Current) / Target decrease
        IF sum_target > 0 THEN
            v_new_progress := LEAST(100, ROUND(((sum_prev - sum_current) / sum_target) * 100));
            v_new_progress := GREATEST(0, v_new_progress);
        ELSE
            v_new_progress := CASE WHEN sum_current < sum_prev THEN 100 ELSE 0 END;
        END IF;

    -- ===== Maintain: Snapshot metric, constant target =====
    -- Success is maintaining a specific value (e.g., service level of 99.5%)
    ELSIF v_metric_type = 'Maintain' THEN

        v_current := p_metrics;

        sum_current := 0;
        sum_target := 0;

        FOR k IN SELECT jsonb_object_keys(v_current) LOOP
            sum_current := sum_current + COALESCE((v_current ->> k)::numeric, 0);
        END LOOP;

        FOR k IN SELECT jsonb_object_keys(v_target) LOOP
            sum_target := sum_target + COALESCE((v_target ->> k)::numeric, 0);
        END LOOP;

        -- If current matches target (within 1% tolerance), progress is 100%
        IF sum_target > 0 AND ABS(sum_current - sum_target) / sum_target <= 0.01 THEN
            v_new_progress := 100;
        ELSIF sum_target > 0 AND sum_current = sum_target THEN
            v_new_progress := 100;
        ELSE
            v_new_progress := 0;
        END IF;

    ELSE
        -- Default to Plus behavior if metric type is unknown
        v_new_progress := 0;
    END IF;

    UPDATE "Activities"
    SET "currentMetric" = v_current,
        "progress" = v_new_progress,
        "updatedAt" = NOW()
    WHERE id = p_activity_id;

    -- Roll up progress to task (weighted average)
    UPDATE "Tasks"
    SET "progress" = (
        SELECT COALESCE(ROUND(SUM(a."progress" * a.weight) / NULLIF(SUM(a.weight), 0)), 0)
        FROM "Activities" a
        WHERE a."taskId" = "Tasks".id
    ),
    "updatedAt" = NOW()
    WHERE id = v_act."taskId";

    -- Roll up task progress to goal (weighted average)
    UPDATE "Goals"
    SET "progress" = (
        SELECT COALESCE(ROUND(SUM(t."progress" * t.weight) / NULLIF(SUM(t.weight), 0)), 0)
        FROM "Tasks" t
        WHERE t."goalId" = "Goals".id
    ),
    "updatedAt" = NOW()
    WHERE id = (SELECT "goalId" FROM "Tasks" WHERE id = v_act."taskId");

    RETURN v_current;
END;
$$;

-- Update Activity completion override handler
-- When isDone is toggled to true, set progress to 100% and force parent recalculation
CREATE OR REPLACE TRIGGER trg_activity_isdone_override
BEFORE UPDATE ON "Activities"
FOR EACH ROW
AS $$
BEGIN
    -- If isDone is being set to true, force progress to 100%
    IF (NEW."isDone" = TRUE AND OLD."isDone" = FALSE) THEN
        NEW."progress" := 100;
        NEW."status" := 'Done'::activity_status;
    END IF;
    
    -- If isDone is being set to false, force a recalculation (set progress to 0 unless metrics suggest otherwise)
    IF (NEW."isDone" = FALSE AND OLD."isDone" = TRUE) THEN
        NEW."progress" := 0;
        IF NEW."status" = 'Done'::activity_status THEN
            NEW."status" := 'In Progress'::activity_status;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trg_activity_isdone_override ON "Activities" CASCADE;

-- Create the trigger
CREATE TRIGGER trg_activity_isdone_override
BEFORE UPDATE ON "Activities"
FOR EACH ROW
EXECUTE FUNCTION trg_activity_isdone_override();
