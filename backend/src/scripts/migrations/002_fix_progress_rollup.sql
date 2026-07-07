-- Migration: Fix progress rollup logic in accumulate_metrics
-- Updates accumulate_metrics to recalculate task and goal progress after activity update


CREATE OR REPLACE FUNCTION safe_numeric(value TEXT) RETURNS NUMERIC LANGUAGE plpgsql AS $$
BEGIN
  IF value IS NULL OR trim(value) = '' THEN
    RETURN NULL;
  END IF;
  BEGIN
    RETURN value::numeric;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN NULL;
  END;
END;
$$;

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
                key_val := safe_numeric(p_metrics ->> k);
                IF key_val IS NOT NULL THEN
                    val_current := COALESCE(safe_numeric(v_current ->> k), 0);
                    v_current := jsonb_set(v_current, ARRAY[k], to_jsonb(val_current + key_val));
                END IF;
            EXCEPTION WHEN others THEN END;
        END LOOP;

        sum_current := 0;
        sum_target := 0;

        FOR k IN SELECT jsonb_object_keys(v_current) LOOP
            val_current := safe_numeric(v_current ->> k);
            sum_current := sum_current + COALESCE(val_current, 0);
        END LOOP;

        FOR k IN SELECT jsonb_object_keys(v_target) LOOP
            val_target := safe_numeric(v_target ->> k);
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
            sum_current := sum_current + COALESCE(safe_numeric(v_current ->> k), 0);
        END LOOP;

        FOR k IN SELECT jsonb_object_keys(v_target) LOOP
            sum_target := sum_target + COALESCE(safe_numeric(v_target ->> k), 0);
        END LOOP;

        FOR k IN SELECT jsonb_object_keys(v_prev) LOOP
            val_prev := val_prev + COALESCE(safe_numeric(v_prev ->> k), 0);
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
            sum_current := sum_current + COALESCE(safe_numeric(v_current ->> k), 0);
        END LOOP;
        FOR k IN SELECT jsonb_object_keys(v_target) LOOP
            sum_target := sum_target + COALESCE(safe_numeric(v_target ->> k), 0);
        END LOOP;
        FOR k IN SELECT jsonb_object_keys(v_prev) LOOP
            val_prev := val_prev + COALESCE(safe_numeric(v_prev ->> k), 0);
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

    -- Roll up progress to task
    UPDATE "Tasks"
    SET "progress" = (
        SELECT COALESCE(ROUND(SUM(a."progress" * a.weight) / NULLIF(SUM(a.weight), 0)), 0)
        FROM "Activities" a
        WHERE a."taskId" = "Tasks".id
    ),
    "updatedAt" = NOW()
    WHERE id = v_act."taskId";

    -- Roll up progress to goal
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