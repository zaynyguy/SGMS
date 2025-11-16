--
-- PostgreSQL database dump
--

\restrict qAgu3JNu6sI0pNFY9ltRfByOXbFD6xevToBoEkbFzbOy22E9N9UznCC7cTJsbed

-- Dumped from database version 18.0
-- Dumped by pg_dump version 18.0

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


--
-- Name: activity_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.activity_status AS ENUM (
    'To Do',
    'In Progress',
    'Done'
);


--
-- Name: goal_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.goal_status AS ENUM (
    'Not Started',
    'In Progress',
    'Completed',
    'On Hold'
);


--
-- Name: report_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.report_status AS ENUM (
    'Pending',
    'Approved',
    'Rejected'
);


--
-- Name: task_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.task_status AS ENUM (
    'To Do',
    'In Progress',
    'Done',
    'Blocked'
);


--
-- Name: accumulate_metrics(integer, jsonb, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.accumulate_metrics(p_activity_id integer, p_metrics jsonb, p_actor_user_id integer DEFAULT NULL::integer) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
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
  -- Replacement: set current metric directly to the provided metrics
  v_current := p_metrics;

  -- compute numeric sums for progress
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
    ('activity', p_activity_id,
     (SELECT gl."groupId" FROM "Activities" a JOIN "Tasks" t ON a."taskId" = t.id JOIN "Goals" gl ON t."goalId" = gl.id WHERE a.id = p_activity_id),
     COALESCE(v_new_progress, 0),
     v_current, NOW(), snap_month)
  ON CONFLICT (entity_type, entity_id, snapshot_month)
  DO UPDATE SET metrics = EXCLUDED.metrics, progress = EXCLUDED.progress, recorded_at = NOW();

  RETURN v_current;
END;
$$;


--
-- Name: sp_submitreport(integer, integer, text, jsonb, character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sp_submitreport(p_activity_id integer, p_user_id integer, p_narrative text, p_metrics_data jsonb, p_new_status character varying) RETURNS integer
    LANGUAGE plpgsql
    AS $$
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
$$;


--
-- Name: trg_assign_activity_rollno(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_assign_activity_rollno() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
$$;


--
-- Name: trg_assign_task_rollno(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_assign_task_rollno() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
$$;


--
-- Name: trg_recalc_goal_progress(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_recalc_goal_progress() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
$$;


--
-- Name: trg_recalc_task_progress(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_recalc_task_progress() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
$$;


--
-- Name: update_updatedat_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updatedat_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END; $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Activities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Activities" (
    id integer NOT NULL,
    "taskId" integer NOT NULL,
    "parentId" integer,
    "rollNo" integer,
    title character varying(255) NOT NULL,
    description text,
    status public.activity_status DEFAULT 'To Do'::public.activity_status NOT NULL,
    "dueDate" date,
    "previousMetric" jsonb DEFAULT '{}'::jsonb,
    "targetMetric" jsonb DEFAULT '{}'::jsonb,
    "currentMetric" jsonb DEFAULT '{}'::jsonb,
    "quarterlyGoals" jsonb DEFAULT '{}'::jsonb,
    progress integer DEFAULT 0 NOT NULL,
    weight numeric DEFAULT 0 NOT NULL,
    "isDone" boolean DEFAULT false,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "Activities_progress_check" CHECK (((progress >= 0) AND (progress <= 100))),
    CONSTRAINT chk_activities_rollno_positive CHECK ((("rollNo" IS NULL) OR ("rollNo" > 0)))
);


--
-- Name: Activities_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Activities_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Activities_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Activities_id_seq" OWNED BY public."Activities".id;


--
-- Name: Activities_rollNo_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Activities_rollNo_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Activities_rollNo_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Activities_rollNo_seq" OWNED BY public."Activities"."rollNo";


--
-- Name: Attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Attachments" (
    id integer NOT NULL,
    "reportId" integer NOT NULL,
    "publicId" character varying(255),
    "fileName" character varying(255) NOT NULL,
    "filePath" text NOT NULL,
    "fileType" character varying(100) NOT NULL,
    provider character varying(20) DEFAULT 'local'::character varying,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: Attachments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Attachments_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Attachments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Attachments_id_seq" OWNED BY public."Attachments".id;


--
-- Name: AuditLogs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AuditLogs" (
    id integer NOT NULL,
    "userId" integer,
    action character varying(100) NOT NULL,
    entity character varying(100) NOT NULL,
    "entityId" integer,
    details jsonb,
    ip character varying(100),
    "userAgent" text,
    before jsonb,
    after jsonb,
    "createdAt" timestamp with time zone DEFAULT now()
);


--
-- Name: AuditLogs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."AuditLogs_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: AuditLogs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."AuditLogs_id_seq" OWNED BY public."AuditLogs".id;


--
-- Name: Goals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Goals" (
    id integer NOT NULL,
    "rollNo" integer,
    title character varying(255) NOT NULL,
    description text,
    "groupId" integer,
    "startDate" date,
    "endDate" date,
    status public.goal_status DEFAULT 'Not Started'::public.goal_status NOT NULL,
    progress integer DEFAULT 0 NOT NULL,
    weight numeric DEFAULT 100 NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "Goals_progress_check" CHECK (((progress >= 0) AND (progress <= 100))),
    CONSTRAINT chk_goals_rollno_positive CHECK (("rollNo" > 0))
);


--
-- Name: Goals_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Goals_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Goals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Goals_id_seq" OWNED BY public."Goals".id;


--
-- Name: Goals_rollNo_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Goals_rollNo_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Goals_rollNo_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Goals_rollNo_seq" OWNED BY public."Goals"."rollNo";


--
-- Name: Groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Groups" (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    "profilePicture" text,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: Groups_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Groups_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Groups_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Groups_id_seq" OWNED BY public."Groups".id;


--
-- Name: Notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Notifications" (
    id integer NOT NULL,
    "userId" integer NOT NULL,
    type character varying(50) NOT NULL,
    message text NOT NULL,
    meta jsonb DEFAULT '{}'::jsonb,
    level character varying(20) DEFAULT 'info'::character varying,
    "isRead" boolean DEFAULT false,
    "createdAt" timestamp with time zone DEFAULT now()
);


--
-- Name: Notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Notifications_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Notifications_id_seq" OWNED BY public."Notifications".id;


--
-- Name: Permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Permissions" (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    description character varying(255),
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: Permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Permissions_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Permissions_id_seq" OWNED BY public."Permissions".id;


--
-- Name: ProgressHistory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ProgressHistory" (
    id integer NOT NULL,
    entity_type character varying(20) NOT NULL,
    entity_id integer NOT NULL,
    group_id integer,
    progress integer DEFAULT 0 NOT NULL,
    metrics jsonb DEFAULT '{}'::jsonb,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    snapshot_month date NOT NULL
);


--
-- Name: ProgressHistory_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."ProgressHistory_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ProgressHistory_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."ProgressHistory_id_seq" OWNED BY public."ProgressHistory".id;


--
-- Name: RefreshTokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RefreshTokens" (
    id integer NOT NULL,
    "userId" integer NOT NULL,
    token_hash text NOT NULL,
    "expiresAt" timestamp with time zone NOT NULL,
    revoked boolean DEFAULT false,
    createdat timestamp with time zone DEFAULT now()
);


--
-- Name: RefreshTokens_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."RefreshTokens_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: RefreshTokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."RefreshTokens_id_seq" OWNED BY public."RefreshTokens".id;


--
-- Name: Reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Reports" (
    id integer NOT NULL,
    "activityId" integer NOT NULL,
    "userId" integer,
    narrative text,
    metrics_data jsonb DEFAULT '{}'::jsonb,
    new_status character varying(50),
    status public.report_status DEFAULT 'Pending'::public.report_status NOT NULL,
    "adminComment" text,
    "resubmissionDeadline" timestamp with time zone,
    applied boolean DEFAULT false,
    "appliedBy" integer,
    "appliedAt" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: Reports_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Reports_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Reports_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Reports_id_seq" OWNED BY public."Reports".id;


--
-- Name: RolePermissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RolePermissions" (
    id integer NOT NULL,
    "roleId" integer NOT NULL,
    "permissionId" integer NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: RolePermissions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."RolePermissions_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: RolePermissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."RolePermissions_id_seq" OWNED BY public."RolePermissions".id;


--
-- Name: Roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Roles" (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    description character varying(255),
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: Roles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Roles_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Roles_id_seq" OWNED BY public."Roles".id;


--
-- Name: SystemSettings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SystemSettings" (
    key character varying(255) NOT NULL,
    value jsonb,
    description text,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: Tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Tasks" (
    id integer NOT NULL,
    "goalId" integer NOT NULL,
    "rollNo" integer,
    title character varying(255) NOT NULL,
    description text,
    status public.task_status DEFAULT 'To Do'::public.task_status NOT NULL,
    "assigneeId" integer,
    "dueDate" date,
    progress integer DEFAULT 0 NOT NULL,
    weight numeric DEFAULT 0 NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "Tasks_progress_check" CHECK (((progress >= 0) AND (progress <= 100))),
    CONSTRAINT chk_tasks_rollno_positive CHECK ((("rollNo" IS NULL) OR ("rollNo" > 0)))
);


--
-- Name: Tasks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Tasks_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Tasks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Tasks_id_seq" OWNED BY public."Tasks".id;


--
-- Name: Tasks_rollNo_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Tasks_rollNo_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Tasks_rollNo_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Tasks_rollNo_seq" OWNED BY public."Tasks"."rollNo";


--
-- Name: UserGroups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UserGroups" (
    id integer NOT NULL,
    "userId" integer NOT NULL,
    "groupId" integer NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: UserGroups_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."UserGroups_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: UserGroups_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."UserGroups_id_seq" OWNED BY public."UserGroups".id;


--
-- Name: Users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Users" (
    id integer NOT NULL,
    username character varying(255) NOT NULL,
    name character varying(255),
    "profilePicture" text,
    password character varying(255) NOT NULL,
    "roleId" integer,
    language character varying(10) DEFAULT 'en'::character varying,
    token_version integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: Users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Users_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Users_id_seq" OWNED BY public."Users".id;


--
-- Name: goals_rollno_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.goals_rollno_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Activities id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Activities" ALTER COLUMN id SET DEFAULT nextval('public."Activities_id_seq"'::regclass);


--
-- Name: Activities rollNo; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Activities" ALTER COLUMN "rollNo" SET DEFAULT nextval('public."Activities_rollNo_seq"'::regclass);


--
-- Name: Attachments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Attachments" ALTER COLUMN id SET DEFAULT nextval('public."Attachments_id_seq"'::regclass);


--
-- Name: AuditLogs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AuditLogs" ALTER COLUMN id SET DEFAULT nextval('public."AuditLogs_id_seq"'::regclass);


--
-- Name: Goals id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Goals" ALTER COLUMN id SET DEFAULT nextval('public."Goals_id_seq"'::regclass);


--
-- Name: Goals rollNo; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Goals" ALTER COLUMN "rollNo" SET DEFAULT nextval('public."Goals_rollNo_seq"'::regclass);


--
-- Name: Groups id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Groups" ALTER COLUMN id SET DEFAULT nextval('public."Groups_id_seq"'::regclass);


--
-- Name: Notifications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Notifications" ALTER COLUMN id SET DEFAULT nextval('public."Notifications_id_seq"'::regclass);


--
-- Name: Permissions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Permissions" ALTER COLUMN id SET DEFAULT nextval('public."Permissions_id_seq"'::regclass);


--
-- Name: ProgressHistory id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProgressHistory" ALTER COLUMN id SET DEFAULT nextval('public."ProgressHistory_id_seq"'::regclass);


--
-- Name: RefreshTokens id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RefreshTokens" ALTER COLUMN id SET DEFAULT nextval('public."RefreshTokens_id_seq"'::regclass);


--
-- Name: Reports id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Reports" ALTER COLUMN id SET DEFAULT nextval('public."Reports_id_seq"'::regclass);


--
-- Name: RolePermissions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RolePermissions" ALTER COLUMN id SET DEFAULT nextval('public."RolePermissions_id_seq"'::regclass);


--
-- Name: Roles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Roles" ALTER COLUMN id SET DEFAULT nextval('public."Roles_id_seq"'::regclass);


--
-- Name: Tasks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Tasks" ALTER COLUMN id SET DEFAULT nextval('public."Tasks_id_seq"'::regclass);


--
-- Name: Tasks rollNo; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Tasks" ALTER COLUMN "rollNo" SET DEFAULT nextval('public."Tasks_rollNo_seq"'::regclass);


--
-- Name: UserGroups id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserGroups" ALTER COLUMN id SET DEFAULT nextval('public."UserGroups_id_seq"'::regclass);


--
-- Name: Users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Users" ALTER COLUMN id SET DEFAULT nextval('public."Users_id_seq"'::regclass);


--
-- Data for Name: Activities; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Activities" (id, "taskId", "parentId", "rollNo", title, description, status, "dueDate", "previousMetric", "targetMetric", "currentMetric", "quarterlyGoals", progress, weight, "isDone", "createdAt", "updatedAt") FROM stdin;
22	8	\N	9	ነቀፌታ ያለበትን የኦዲት ግኝት መቀነስ	\N	To Do	\N	{}	{"በብር": "0"}	{}	{}	0	0.25	f	2025-10-13 00:36:09.665603+03	2025-10-13 00:36:09.665603+03
7	6	\N	3	ወቅቱንና ጥራቱን የጠበቀ ግምገማ ማድረግ	\N	To Do	\N	{"በሰነድ": "6"}	{"በሰነድ": "6"}	{}	{"q1": 1, "q2": 2, "q3": 1, "q4": 2}	0	0.5	f	2025-10-13 00:15:22.612515+03	2025-11-11 15:13:29.614794+03
8	6	\N	4	የዘርፉን መረጃ አያያዝ በቴክኖሎጂ በመደገፍ ማደራጀት	\N	To Do	\N	{"በመቶኛ": "100"}	{"በመቶኛ": "100"}	{}	{"q1": 100, "q2": 100, "q3": 100, "q4": 100}	0	0.5	f	2025-10-13 00:21:40.706275+03	2025-11-11 15:15:13.009333+03
9	7	\N	1	ግልጽነት የሰፈነበት የሰው ኃይል ስምሪት ማካሄድ	\N	To Do	\N	{"በመቶኛ": "100"}	{"በመቶኛ": "100"}	{}	{"q1": 100, "q2": 100, "q3": 100, "q4": 100}	0	0.5	f	2025-10-13 00:23:46.356153+03	2025-11-11 15:15:41.021989+03
10	7	\N	2	ለአመራር እና ለሰራተኞች የሚሰጡ ሥልጠናዎችን ማሳደግ	\N	To Do	\N	{"በቁጥር": "60"}	{"በቁጥር": "200"}	{}	{"q2": 150, "q4": 50}	0	0.5	f	2025-10-13 00:24:53.479878+03	2025-11-11 15:16:29.322911+03
11	7	\N	3	የውስጥ የማበረታቻ ስርዓት መዘርጋት	\N	To Do	\N	{"በጊዜ": "1"}	{"በጊዜ": "1"}	{}	{"q4": 1}	0	0.5	f	2025-10-13 00:25:25.932184+03	2025-11-11 15:16:49.458034+03
12	7	\N	4	የሰራተኛ ዕርካታን ማሳደግ	\N	To Do	\N	{"በመቶኛ": "53.5"}	{"በመቶኛ": "60"}	{}	{"q3": 60}	0	0.25	f	2025-10-13 00:26:14.654697+03	2025-11-11 15:26:29.870993+03
13	7	\N	5	የሰራተኛ ፍልሰትን መቀነስ	\N	To Do	\N	{"በመቶኛ": "0.0037"}	{"በመቶኛ": "0"}	{}	{"q1": 0, "q2": 0, "q3": 0, "q4": 0}	0	0.25	f	2025-10-13 00:26:59.30462+03	2025-11-11 15:27:50.514102+03
15	8	\N	2	ወቅቱን እና ጥራቱን የጠበቀ የሂሳብ ሪፖርት	\N	To Do	\N	{"በሰነድ": "12"}	{"በሰነድ": "12"}	{}	{"q1": 3, "q2": 3, "q3": 3, "q4": 3}	0	0.06	f	2025-10-13 00:29:07.564884+03	2025-11-11 15:32:46.842948+03
16	8	\N	3	በIBEX የተመዘገበ የበጀት ኮንትሮል ሪፖርት	\N	To Do	\N	{"በሰነድ": "1"}	{"በሰነድ": "1"}	{}	{"q4": 1}	0	0.03	f	2025-10-13 00:29:43.059829+03	2025-11-11 15:33:40.193381+03
17	8	\N	4	ተዘጋጅቶ የጸደቀ የተቋሙ የግዥ እቅድ	\N	To Do	\N	{"በሰነድ": "1"}	{"በሰነድ": "1"}	{}	{"q1": 1}	0	0.04	f	2025-10-13 00:30:17.083908+03	2025-11-11 15:34:03.715562+03
18	8	\N	5	በግዢ እቅዱ መሰረት የተዘጋጀ ሪፖርት	\N	To Do	\N	{"በሰነድ": "2"}	{"በሰነድ": "2"}	{}	{"q2": 1, "q4": 1}	0	0.04	f	2025-10-13 00:31:10.749305+03	2025-11-11 15:34:52.986825+03
19	8	\N	6	የተፈጸመ የግልጽ ጨረታ ግዢ ድርሻ	\N	To Do	\N	{"በመቶኛ": "85"}	{"በመቶኛ": "87"}	{}	{"q4": 87}	0	0.04	f	2025-10-13 00:32:02.835341+03	2025-11-11 15:35:23.507481+03
21	8	\N	8	ነቀፌታ ያለበትን የኦዲት ግኝት መቀነስ	\N	To Do	\N	{"በቁጥር": "0"}	{"በቁጥር": "0"}	{}	{"q4": 0}	0	0.5	f	2025-10-13 00:35:16.843094+03	2025-11-11 15:36:38.511393+03
23	8	\N	10	አጠቃላይ ቆጠራ ተደርጎ፣ ዋጋ ተሰጥቶት፣ ተመዝግቦ መለያ ምልክት የተለጠፈበት ቋሚ ንብረት	\N	To Do	\N	{"በመቶኛ": "100"}	{"በመቶኛ": "100"}	{}	{"q4": 100}	0	0.5	f	2025-10-13 00:36:48.014762+03	2025-11-11 15:37:34.856384+03
26	8	\N	13	በፕሮግራሙ መሰረት ጥገና የተደረገላቸዉ ቋሚ ንብረቶች	\N	To Do	\N	{"በቁጥር": "3"}	{"በቁጥር": "10"}	{}	{"q3": 5, "q4": 5}	0	0.25	f	2025-10-13 00:38:53.371746+03	2025-11-11 15:39:20.457258+03
25	8	\N	12	የቋሚ ንብረት ጥገናና ዕድሳት ስኬጁል ማዘጋጀት	\N	To Do	\N	{"በሰነድ": "3"}	{"በሰነድ": "1"}	{}	{"q1": 1}	0	0.5	f	2025-10-13 00:38:30.053737+03	2025-11-11 15:38:39.477442+03
27	9	\N	1	መረጃ ቋት ማደራጀት	\N	To Do	\N	{"በመቶኛ": "97"}	{"በመቶኛ": "100"}	{}	{"q2": 98, "q4": 100}	0	0.25	f	2025-10-13 00:39:56.873144+03	2025-11-11 15:41:41.22569+03
28	9	\N	2	በተቋሙ ወረቀት አልባ አሰራርን መተግበር	\N	To Do	\N	{"በመቶኛ": "60"}	{"በመቶኛ": "80"}	{}	{"q1": 65, "q2": 70, "q3": 75, "q4": 80}	0	0.25	f	2025-10-13 00:40:24.524577+03	2025-11-11 15:42:09.381817+03
30	9	\N	4	የተሻሻለና ደህንነቱ የተረጋገጠ የኢኮቴ አጠቃቀም	\N	To Do	\N	{"በመቶኛ": "75"}	{"በመቶኛ": "100"}	{}	{"q1": 80, "q3": 90, "q4": 100}	0	0.25	f	2025-10-13 00:41:19.299746+03	2025-11-11 15:43:13.864977+03
31	10	\N	1	ለተቋም አቅም ግንባታ በክልል ውስጥ አጋርነት የተገኘ ድጋፍ	\N	To Do	\N	{"በብር": "45000"}	{"በብር": "1000000"}	{}	{"q3": 1000000}	0	0.25	f	2025-10-13 00:42:45.939962+03	2025-11-11 15:44:13.498104+03
32	10	\N	2	ለተቋም አቅም ግንባታ በሀገር ዉስጥ አጋርነት የተገኘ ድጋፍ ለመሰብሰብ፤	\N	To Do	\N	{"በብር": "50000"}	{"በብር": "100000"}	{}	{"q4": 100000}	0	0.25	f	2025-10-13 00:43:18.082278+03	2025-11-11 15:44:46.201625+03
35	11	\N	2	የየሩብ ዓመት የተጠሪ ተቋማት ሪፖርት መገምገም	\N	To Do	\N	{"በቁጥር": "3"}	{"በቁጥር": "4"}	{}	{"q1": 1, "q2": 1, "q3": 1, "q4": 1}	0	0.2	f	2025-10-13 00:45:09.364258+03	2025-11-11 15:48:00.018251+03
36	11	\N	3	የቢሮዉን/ተቋሙን ዕቅድ ከክልሉ ዕቅድ ጋር ማናበብና ማጣጣም	\N	To Do	\N	{"በሰነድ": "1"}	{"በሰነድ": "1"}	{}	{"q1": 2}	0	0.2	f	2025-10-13 00:45:37.160057+03	2025-11-11 15:48:34.581453+03
37	11	\N	4	የተቋሙን/የቢሮዉን ዕቅድ ለወረዳ ማዉረድ	\N	To Do	\N	{"በሰነድ": "9"}	{"በሰነድ": "9"}	{}	{"q1": 9}	0	0.2	f	2025-10-13 00:46:50.195655+03	2025-11-11 15:49:12.803451+03
39	12	\N	1	በብልሹ አሰራር ዙርያ ጥቆማ ከተደረገባቸው ውስጥ ማስተካከያ የተደረገባቸው	\N	To Do	\N	{"በመቶኛ": "100"}	{"በመቶኛ": "100"}	{}	{"q1": 100, "q2": 100, "q3": 100, "q4": 100}	0	0.25	f	2025-10-13 00:49:40.867687+03	2025-11-11 15:50:57.564987+03
40	12	\N	2	ለብልሹ አሰራር የተጋለጡ አሰራሮች በጥናት በመለየት የማሻሻያ ሀሳብ ማቅረብ	\N	To Do	\N	{"በቁጥር": "2"}	{"በቁጥር": "1"}	{}	{"q3": 1}	0	0.5	f	2025-10-13 00:50:05.9066+03	2025-11-11 15:51:23.019773+03
75	17	\N	3	የማህበረ ኢኮኖሚ ፕላን ትግበራ ላይ ክትትልና ቁጥጥር ማድረግ	\N	To Do	\N	{"በሰነድ": "1"}	{"በሰነድ": "1"}	{}	{"q4": 1}	0	0.5	f	2025-10-13 06:20:43.589269+03	2025-11-11 16:27:35.498105+03
34	11	\N	1	የተጠሪ ተቋማት ዕቅድን ከዘርፍ ዕቅድ ጋር ማናበብና ማጣጣም	\N	To Do	\N	{"በሰነድ": "6"}	{"በሰነድ": "6"}	{}	{"q1": 6}	0	0.2	f	2025-10-13 00:44:42.764786+03	2025-11-12 23:10:55.400303+03
42	12	\N	4	የሀብት ምዝገባ ያካሄዱ አመራሮች እና ባለሞያዎች ድርሻ ማሳደግ	\N	To Do	\N	{"በቁጥር": "37"}	{"በቁጥር": "100"}	{}	{"q3": 100}	0	0.25	f	2025-10-13 00:54:31.928663+03	2025-11-11 15:52:14.052802+03
43	13	\N	1	የህጻናት ማቆያ አገልግሎት ተጠቃሚ ሰራተኞች ብዛት ማሳደግ	\N	To Do	\N	{"በቁጥር": "9"}	{"በቁጥር": "10"}	{}	{"q4": 10}	0	0.25	f	2025-10-13 00:56:49.859766+03	2025-11-11 15:53:05.23862+03
44	13	\N	2	ወደ አመራር የመጡ ሴት ሰራተኞች ብዛት ማሳደግ	\N	To Do	\N	{"በመቶኛ": "27.5"}	{"በመቶኛ": "50"}	{}	{"q4": 50}	0	0.25	f	2025-10-13 00:57:17.692331+03	2025-11-11 15:53:33.495864+03
46	13	\N	4	ለአካል ጉዳተኛ ሰራተኞችና ተገልጋዮች ምቹ የስራ ሁኔታና ቦታ መፍጠር	\N	To Do	\N	{"በመቶኛ": "50"}	{"በመቶኛ": "100"}	{}	{"q1": 60, "q2": 65, "q3": 70, "q4": 100}	0	0.25	f	2025-10-13 00:58:13.18853+03	2025-11-11 15:54:22.750709+03
47	14	\N	1	የአረንጓዴ አሻራ ተግባራትን ማካሄድ የቀረበ ችግኝ	\N	To Do	\N	{"በቁጥር": "2800"}	{"በቁጥር": "1602"}	{}	{"q1": 1602}	0	0.2	f	2025-10-13 05:44:09.471406+03	2025-11-11 15:57:52.410459+03
48	14	\N	2	የአረንጓዴ አሻራ ተግባራትን ማካሄድ የተተከለ ችግኝ	\N	To Do	\N	{"በቁጥር": "2800"}	{"በቁጥር": "1602"}	{}	{"q1": 1602}	0	0.15	f	2025-10-13 05:44:39.657945+03	2025-11-11 15:58:15.452451+03
50	14	\N	4	የአረንጓዴ አሻራ ተግባራትን ማካሄድ የጸደቀ ችግኝ	\N	To Do	\N	{"በቁጥር": "1000"}	{"በቁጥር": "1361"}	{}	{"q1": 1361, "q4": 1361}	0	0.15	f	2025-10-13 05:46:07.934083+03	2025-11-11 16:00:37.56561+03
51	14	\N	5	የአቅመ ደካማ ማህበረሰቦች የመኖሪያ ቤቶች መገንባት (ማደስ) ብዛት	\N	To Do	\N	{"በቁጥር": "4"}	{"በቁጥር": "4"}	{}	{"q1": 2, "q4": 2}	0	0.15	f	2025-10-13 05:46:39.000246+03	2025-11-11 16:01:05.760708+03
52	14	\N	6	የአቅመ ደካማ ማህበረሰቦች የመኖሪያ ቤቶች መገንባት (ማደስ) በብር\t0.15\tበብር\t3ሚ	\N	To Do	\N	{"በብር": "3000000"}	{"በብር": "1500000"}	{}	{"q1": 700000, "q4": 800000}	0	0.15	f	2025-10-13 05:47:59.237539+03	2025-11-11 16:03:44.246408+03
54	14	\N	8	ለተለያዩ ማህበራዊ ቀውሶች የተደረገ ድጋፍ	\N	To Do	\N	{"በብር": "200000"}	{"በብር": "400000"}	{}	{"q1": 100000, "q2": 100000, "q3": 100000, "q4": 100000}	0	0.5	f	2025-10-13 05:50:21.673807+03	2025-11-11 16:06:25.462816+03
55	14	\N	9	የተደረገ ደም ልገሳ	\N	To Do	\N	{"ዩኒት": "13"}	{"ዩኒት": "30"}	{}	{"q2": 15, "q4": 15}	0	0.5	f	2025-10-13 05:51:55.892954+03	2025-11-11 16:07:05.950057+03
56	14	\N	10	ወላጆቻቸውን ያጡ ህፃናትን መደገፍ ብዛት በቁጥር	\N	To Do	\N	{"በቁጥር": "10"}	{"በቁጥር": "10"}	{}	{"q3": 10}	0	0.2	f	2025-10-13 05:52:18.989475+03	2025-11-11 16:07:31.756343+03
59	15	\N	2	የሰፈር ልማት ፕላኖችን በአማካሪ ድርጅት ማዘጋጀት	\N	To Do	\N	{"በቁጥር": "6"}	{"በቁጥር": "4"}	{}	{"q3": 4}	0	0.5	f	2025-10-13 06:12:26.789997+03	2025-11-11 16:15:51.27873+03
58	15	\N	1	12 ነባር የአካባቢ ልማት ፕላን ዝግጅት ስራዎችን እንዲፀድቁ ለማድረግ የክትትል ሥራ መስራት	\N	To Do	\N	{"በሰነድ": "8"}	{"በሰነድ": "12"}	{}	{"q2": 12}	0	0.5	f	2025-10-13 06:11:50.814165+03	2025-11-11 16:14:39.128564+03
60	15	\N	3	ለሰፈር ልማት ፕላን ዝግጅት የሚሆኑ 4 መሰረታዊ ካርታዎች ማዘጋጀት	\N	To Do	\N	{"በቁጥር": ""}	{"በቁጥር": "4"}	{}	{"q2": 4}	0	0.5	f	2025-10-13 06:12:52.172431+03	2025-11-11 16:16:28.720943+03
61	15	\N	4	2 በመልሶ ማልማት የከተማ ዲዛይን በተመረጡ የከተማው እንብርት ቦታዎች በራስ አገዝ እንዲሰሩ ማድረግ	\N	To Do	\N	{"በሰነድ": "2"}	{"በሰነድ": "2"}	{}	{"q2": 1, "q3": 1}	0	1	f	2025-10-13 06:13:20.427293+03	2025-11-11 16:17:24.710136+03
63	15	\N	6	አንድ ቤዚክ ፕላን ለገጠር ጥንስስ ከተማ ማዘጋጀት በራስ አገዝ ማዘጋጀት	\N	To Do	\N	{"በሰነድ": "1"}	{"በሰነድ": "1"}	{}	{"q3": 1}	0	1	f	2025-10-13 06:14:07.004779+03	2025-11-11 16:18:40.065547+03
64	15	\N	7	በዩን ሃቢታት አየተዘጋጀ ያለው ክልላዊ ሰፓሻል ፕላንን የተረከብነውን በክልል ምክር ቤት እንዲፀድቅ ክትትል ማድረግ	\N	To Do	\N	{"በሰነድ": ""}	{"በሰነድ": "1"}	{}	{"q4": 1}	0	0.5	f	2025-10-13 06:14:56.397143+03	2025-11-11 16:19:07.790721+03
65	15	\N	8	በፕላን የሚመሩ የገጠር ማዕከላት ሽፋን ማሳደግ	\N	To Do	\N	{"በመቶኛ": "70"}	{"በመቶኛ": "80"}	{}	{"q2": 75, "q4": 80}	0	0.5	f	2025-10-13 06:15:25.101286+03	2025-11-11 16:19:45.810651+03
66	15	\N	9	በፕላን የሚመሩ ከተሞች ሽፋን ማሳደግ	\N	To Do	\N	{"በመቶኛ": "48"}	{"በመቶኛ": "80"}	{}	{"q2": 60, "q4": 80}	0	0.5	f	2025-10-13 06:15:49.214401+03	2025-11-11 16:20:41.037659+03
67	15	\N	10	የሰፈር ልማት ፕላኖች ሽፋን ማሳደግ	\N	To Do	\N	{"በመቶኛ": "46"}	{"በመቶኛ": "55"}	{}	{"q2": 50, "q4": 55}	0	0.5	f	2025-10-13 06:16:16.845141+03	2025-11-11 16:21:18.368909+03
69	16	\N	2	የገጠር ኮሪደር ልማት የሚዘጋጅላቸው የገጠር ዕድገት ማእከላት ስኬች ፕላን ጥናቶችን ማዘጋጀት	\N	To Do	\N	{"በሰነድ": "6"}	{"በሰነድ": "6"}	{}	{"q2": 3}	0	0.5	f	2025-10-13 06:17:36.115513+03	2025-11-11 16:23:42.304653+03
70	16	\N	3	በተዘጋጁ ስኬች ፕላን ጥናት ላይ ለሚመለከታቸው ባለድርሻ አካለት የግንዛቤ መፍጠሪያ መድረክ ማዘጋጀት	\N	To Do	\N	{"በመድረክ": "2"}	{"በመድረክ": "2"}	{}	{"q1": 1, "q3": 1}	0	0.25	f	2025-10-13 06:18:01.511188+03	2025-11-11 16:24:22.258757+03
71	16	\N	4	ከተሞች ወደ Smart city ትግበራ እንዲገቡ ይደረጋል የጥናትና የዝግጅት ምዕራፍ ሥራዎች መስራት	\N	To Do	\N	{"በሰነድ": ""}	{"በሰነድ": "1"}	{}	{"q3": 1}	0	0.5	f	2025-10-13 06:18:27.658258+03	2025-11-11 16:25:02.993242+03
73	17	\N	1	የስፓሻል ፕላን ትግበራ ላይ ክትትልና ቁጥጥር ማድረግ	\N	To Do	\N	{"በሰነድ": "1"}	{"በሰነድ": "1"}	{}	{"q4": 1}	0	0.5	f	2025-10-13 06:19:58.133631+03	2025-11-11 16:26:32.601648+03
74	17	\N	2	የአረንጓዴ ልማት ፕላን ትግበራ ላይ ክትትልና ቁጥጥር ማድረግ	\N	To Do	\N	{"በሰነድ": "2"}	{"በሰነድ": "2"}	{}	{"q2": 1, "q4": 1}	0	0.5	f	2025-10-13 06:20:21.870427+03	2025-11-11 16:27:08.423983+03
77	17	\N	5	የመሬት ሽንሻኖ ፕላን ትግበራ ላይ ክትትልና ቁጥጥር ማድረግ	\N	To Do	\N	{"በሰነድ": "2"}	{"በሰነድ": "2"}	{}	{"q2": 1, "q4": 1}	0	0.5	f	2025-10-13 06:21:26.326124+03	2025-11-11 16:29:03.193229+03
79	17	\N	7	ለሚፀድቁት ሰፈር ልማት ፕላን ትግበራ ላይ ክትትልና ቁጥጥር ማድረግ	\N	To Do	\N	{"በሰነድ": "2"}	{"በሰነድ": "2"}	{}	{"q2": 1, "q4": 1}	0	0.5	f	2025-10-13 06:22:29.450113+03	2025-11-11 16:29:55.748251+03
80	17	\N	8	የኤረርና ድሬጠያራ ከተሞች ፕላን ክትትልና ድጋፍ ማድረግ	\N	To Do	\N	{"በሰነድ": "0"}	{"በሰነድ": "1"}	{}	{"q2": 1}	0	0.75	f	2025-10-13 06:22:58.175695+03	2025-11-11 16:30:22.610185+03
81	17	\N	9	የከተማ ፕላን ትግበራ ክትትልና ቁጥጥር ሽፋን ማሳደግ	\N	To Do	\N	{"በመቶኛ": "70"}	{"በመቶኛ": "100"}	{}	{"q2": 80, "q4": 100}	0	0.75	f	2025-10-13 06:23:26.07747+03	2025-11-11 16:30:54.266223+03
82	18	\N	1	የማስተግበሪያ ሰነድ ማዘጋጀት	\N	To Do	\N	{"በሰነድ": "1"}	{"በሰነድ": "1"}	{}	{"q2": 1}	0	0.25	f	2025-10-13 06:24:14.540299+03	2025-11-11 16:33:06.052462+03
83	18	\N	2	የተዘጋጁ ፕላኖችንና የማስፈጸሚያ ዕቅዶቹ ላይ ስልጠና መስጠት	\N	To Do	\N	{"በመድረክ": "0"}	{"በመድረክ": "2"}	{}	{"q2": 1, "q3": 1}	0	0.5	f	2025-10-13 06:24:44.128024+03	2025-11-11 16:33:33.923542+03
84	18	\N	3	በሚመለከታቸዉ አካላት እንዲፀድቅ ክትትል ማድረግ	\N	To Do	\N	{"በሰነድ": "1"}	{"በሰነድ": "1"}	{}	{"q2": 1}	0	0.25	f	2025-10-13 06:25:10.36608+03	2025-11-11 16:34:06.78814+03
85	18	\N	4	ወረዳዎቹንና የልማት ማዕከላቱን የባለሞያ ድጋፍ መስጠት	\N	To Do	\N	{"በቁጥር": "6"}	{"በቁጥር": "3"}	{}	{"q2": 1, "q3": 1, "q4": 1}	0	0.25	f	2025-10-13 06:25:34.288224+03	2025-11-11 16:34:41.26052+03
86	19	\N	1	የከተማ ፕላን ክዋኔ ኦዲት አመታዊ መርሃ ግብር ማዘጋጀት	\N	To Do	\N	{"በሰነድ": "2"}	{"በሰነድ": "1"}	{}	{"q1": 1}	0	1	f	2025-10-13 06:26:20.9003+03	2025-11-11 16:35:22.753308+03
87	19	\N	2	የከተማ ፕላን ትግበራ ክዋኔ ኦዲት ማካሄድ	\N	To Do	\N	{"በሰነድ": "4"}	{"በሰነድ": "1"}	{}	{"q4": 1}	0	1.5	f	2025-10-13 06:26:47.774379+03	2025-11-11 16:35:58.112345+03
88	20	\N	1	የመሬት ፍላጎትንና መቸት መለየት	\N	To Do	\N	{"ሰነድ": "1"}	{"ሰነድ": "1"}	{}	{"q1": 1}	0	0.5	f	2025-10-13 06:28:08.395653+03	2025-11-11 16:37:17.789007+03
89	20	\N	2	የመሬት ማዘጋጀት	\N	To Do	\N	{"በሄክታር": "39.01"}	{"በሄክታር": "50"}	{}	{"q1": 10, "q2": 15, "q3": 15, "q4": 10}	0	0.75	f	2025-10-13 06:29:00.344499+03	2025-11-11 16:38:27.492225+03
91	20	\N	4	ለተሻሻለው የካሳ አዋጅ ቁጥር 1336/2016 ማስፈጸሚያ ክልላዊ መመርያ እንዲዘጋጅ ይደረጋል	\N	To Do	\N	{"በሰነድ": ""}	{"በሰነድ": "1"}	{}	{"q4": 1}	0	0.25	f	2025-10-13 06:30:15.143022+03	2025-11-11 16:39:27.52496+03
92	21	\N	1	መሬት ለልማት ማስተላለፍ	\N	To Do	\N	{"በሄክታር": "40.96"}	{"በሄክታር": "50"}	{}	{"q1": 10, "q2": 15, "q3": 15, "q4": 10}	0	0.75	f	2025-10-13 06:31:24.862011+03	2025-11-11 16:40:10.49596+03
94	21	\N	3	ለንግድ አገልግሎት የተላለፈ መሬት	\N	To Do	\N	{"በሄክታር": "4.05"}	{"በሄክታር": "5"}	{}	{"q1": 1, "q2": 1.5, "q3": 1.5, "q4": 1}	0	0.75	f	2025-10-13 06:32:15.173445+03	2025-11-11 16:42:09.004274+03
95	21	\N	4	ለማህበራዊ አገልግሎት የተላለፈ መሬት	\N	To Do	\N	{"በሄክታር": "8.61"}	{"በሄክታር": "9"}	{}	{"q1": 2, "q2": 2.5, "q3": 2.5, "q4": 2}	0	0.75	f	2025-10-13 06:32:45.283017+03	2025-11-11 16:43:10.934663+03
97	21	\N	6	ለኢንዱስትሪ አገልግሎት የተላለፈ መሬት	\N	To Do	\N	{"በሄክታር": "3.5"}	{"በሄክታር": "6"}	{}	{"q1": 1.2, "q2": 1.8, "q3": 1.8, "q4": 1.2}	0	0.75	f	2025-10-13 06:33:33.810003+03	2025-11-11 16:44:44.656734+03
99	21	\N	8	ለከተማ ግብርና አገልግለሎት የተላለፈ መሬት	\N	To Do	\N	{"በሄክታር": "2"}	{"በሄክታር": "2"}	{}	{"q2": 1, "q3": 1}	0	0.75	f	2025-10-13 06:34:24.479137+03	2025-11-11 16:46:18.745556+03
100	21	\N	9	ለአረንጓዴ፣ ለመዝናኛና አከባቢ ጥበቃ የተላለፈ/የተጠበቀ መሬት	\N	To Do	\N	{"በሄክታር": "4.57"}	{"በሄክታር": "4"}	{}	{"q1": 1, "q2": 1, "q3": 1, "q4": 1}	0	0.75	f	2025-10-13 06:34:53.129156+03	2025-11-11 16:47:02.278264+03
101	22	\N	1	አዲስ ይዞታ ማረጋገጫ ማስረጃ መስጠት	\N	To Do	\N	{"በቁጥር": "6275"}	{"በቁጥር": "8000"}	{}	{"q1": 1600, "q2": 2400, "q3": 2400, "q4": 1500}	0	0.25	f	2025-10-13 06:35:42.59349+03	2025-11-11 16:49:16.360421+03
103	22	\N	3	ለሰነድ አልባ ይዞታዎች እና የመንግስት ተቋም (የቀበሌ እና ኪራይ ቤት) ሰነድ መስጠት	\N	To Do	\N	{"በቁጥር": "3672"}	{"በቁጥር": "4500"}	{}	{"q1": 900, "q2": 1350, "q3": 1350, "q4": 900}	0	0.25	f	2025-10-13 06:36:37.990075+03	2025-11-11 16:51:47.320152+03
104	22	\N	4	የመሬት ይዞታን ማሻሻል	\N	To Do	\N	{"በቁጥር": "789"}	{"በቁጥር": "1000"}	{}	{"q1": 200, "q2": 300, "q3": 300, "q4": 200}	0	0.25	f	2025-10-13 06:37:14.680871+03	2025-11-11 16:53:04.13012+03
106	22	\N	6	በክልሉ 5,000 በቁራሽ መሬት (10 ሄክታር) ላይ የሚገኝ የመሬት ሀብታቸውን ቆጥረውና መዝግበው ወቅታዊ እንዲያደርጉና እንዲያስተዳድሩ ይደረጋል	\N	To Do	\N	{"በሄክታር": ""}	{"በሄክታር": "10"}	{}	{"q1": 2, "q2": 3, "q3": 3, "q4": 2}	0	0.25	f	2025-10-13 06:39:14.463306+03	2025-11-11 16:56:51.311083+03
107	23	\N	1	ከመሬት ነክ ቋሚ ንብረት ገቢን ማሰባሰብ	\N	To Do	\N	{"በብር": "34563136000"}	{"በብር": "500000000"}	{}	{"q1": 100000, "q2": 150000, "q3": 150000, "q4": 100000}	0	1.5	f	2025-10-13 06:40:21.902482+03	2025-11-11 16:58:49.714651+03
108	23	\N	2	ለልማት ተነሺዎች ካሳ መክፈል	\N	To Do	\N	{"በብር": "21329005300"}	{"በብር": "200000000"}	{}	{"q1": 40000, "q2": 60000, "q3": 60000, "q4": 40000}	0	1.5	f	2025-10-13 06:40:47.299541+03	2025-11-11 17:00:14.068669+03
109	24	\N	1	የመሬት ይዞታ ማህደራትን ማደራጀት	\N	To Do	\N	{"በቁጥር": "15909"}	{"በቁጥር": "12500"}	{}	{"q1": 2500, "q2": 3750, "q3": 3750, "q4": 2500}	0	0.75	f	2025-10-13 06:42:58.275036+03	2025-11-11 17:01:40.109294+03
118	25	\N	8	ከባለድረሻ አካላት ጋር MOU መፈራረም	\N	To Do	\N	{"የተዘጋጀ ሰነድ": "1"}	{"የተዘጋጀ ሰነድ": "13"}	{}	{"q1": 13}	0	0.25	f	2025-10-13 06:48:43.115638+03	2025-11-11 17:09:24.441338+03
112	25	\N	2	ቅሬታ ሰሚ ጉባኤ ማደራጀትና ታዛቢ ኮሚቴ ማዋቀር	\N	To Do	\N	{"በቀጠና ብዛት": "4"}	{"በቀጠና ብዛት": "4"}	{}	{"q1": 1, "q2": 1, "q3": 1, "q4": 1}	0	0.5	f	2025-10-13 06:45:29.066127+03	2025-11-11 17:05:01.225677+03
113	25	\N	3	ለተመረጡ ቅሬታ ሰሚ ጉባኤ እና ታዛቢ ኮሚቴ አባላት ማበረታቻ ክፍያ መመሪያ ማዘጋጀት	\N	To Do	\N	{"በሰነድ": ""}	{"በሰነድ": "1"}	{}	{"q1": 1}	0	0.25	f	2025-10-13 06:46:10.418919+03	2025-11-11 17:05:38.190677+03
115	25	\N	5	ሕጋዊ ካዳስተር ለመተግበር ለፈጻሚዎችንና አስፈጻሚ አካላት የግንዛቤ ማስጨበጫ ስልጠና መስጠት	\N	To Do	\N	{"በመድረክ": "3"}	{"በመድረክ": "3"}	{}	{"q1": 1, "q2": 1, "q3": 1}	0	0.25	f	2025-10-13 06:47:14.801325+03	2025-11-11 17:07:12.36466+03
116	25	\N	6	የከተማ መሬት ምዝገባ ፕሮግራም ለማስፈጸም የሚያስችል ለህብረተሰብ ግንዛቤ ማስጨበጫ መስጠት	\N	To Do	\N	{"በመድረክ": "4"}	{"በመድረክ": "4"}	{}	{"q1": 1, "q2": 1, "q3": 1, "q4": 1}	0	0.25	f	2025-10-13 06:47:38.38125+03	2025-11-11 17:08:02.054999+03
117	25	\N	7	ኦርቶፎቶ በመጠቀም ለመሬት ይዞታ ማረጋገጫ ማከናወኛ ካርታና ኢንዴክስ ማፕ ማዘጋጀት	\N	To Do	\N	{"በቁራሽ መሬት በቁጥር": "14200"}	{"በቁራሽ መሬት በቁጥር": "15000"}	{}	{"q1": 3000, "q2": 4500, "q3": 4500, "q4": 3000}	0	0.5	f	2025-10-13 06:48:01.719463+03	2025-11-11 17:08:56.87086+03
120	26	\N	2	በተመረጡ ቀጠናዎች ውስጥ ይዞታዎችን የቅየሳ ስራ መስራት	\N	To Do	\N	{"በቁራሽ መሬት በቁጥር": "15000"}	{"በቁራሽ መሬት በቁጥር": "3000"}	{}	{"q1": 4500, "q2": 4500, "q3": 4500, "q4": 3000}	0	0.5	f	2025-10-13 06:50:17.073635+03	2025-11-11 17:11:13.35195+03
121	26	\N	3	የመሬት ይዞታን ማረጋገጥ	\N	To Do	\N	{"በቁራሽ መሬት በቁጥር": "12486"}	{"በቁራሽ መሬት በቁጥር": "15000"}	{}	{"q1": 3000, "q2": 4500, "q3": 4500, "q4": 3000}	0	2	f	2025-10-13 06:50:51.131166+03	2025-11-11 17:12:27.899409+03
123	26	\N	5	የካዳስተር ቁራሽ መሬት የይዞታ ማረጋገጫ ካርታ እንዲዘጋጅ ማድረግ	\N	To Do	\N	{"የይዞታ ማረጋገጫ ካርታ በቁጥር": ""}	{"የይዞታ ማረጋገጫ ካርታ በቁጥር": "15000"}	{}	{"q1": 3000, "q2": 4500, "q3": 4500, "q4": 3000}	0	0.25	f	2025-10-13 06:52:12.092208+03	2025-11-11 17:14:12.878034+03
124	26	\N	6	የአድራሻ ስርዓት ካርታ በአማካሪ የትግበራ አፕሊኬሽን እንዲዘጋጅ ማድረግ	\N	To Do	\N	{"በከተማ ቁጥር": ""}	{"በከተማ ቁጥር": "1"}	{}	{"q1": 1}	0	0.25	f	2025-10-13 06:52:37.150939+03	2025-11-11 17:15:13.391166+03
126	27	\N	1	በማረጋገጥ ሂደቱ ብቁ የሆኑትን ይዞታወችን በሲስተም በመመዝገብ የምዝገባ ሰርቲፊኬት መስጠት	\N	To Do	\N	{"በቁጥር": "2063"}	{"በቁጥር": "6500"}	{}	{"q1": 1300, "q2": 1950, "q3": 1950, "q4": 1300}	0	1	f	2025-10-13 06:53:50.8319+03	2025-11-11 17:16:52.253785+03
127	27	\N	2	በማረጋገጥ ሂደቱ ብቁ የሆኑትን ይዞታወችን በማንዋል በመመዝገብ የምዝገባ ሰርቲፊኬት መስጠት	\N	To Do	\N	{"በቁጥር": "3325"}	{"በቁጥር": "6000"}	{}	{"q1": 1200, "q2": 1800, "q3": 1800, "q4": 1200}	0	1	f	2025-10-13 06:55:06.209907+03	2025-11-11 17:18:27.120668+03
128	28	\N	1	የመሬት ይዞታ ማረጋገጥና ምዝገባ አገልገሎት መስጠት	\N	To Do	\N	{"በቁጥር": "3325"}	{"በቁጥር": "6000"}	{}	{"q1": 1200, "q2": 1800, "q3": 1800, "q4": 1200}	0	1	f	2025-10-13 06:56:31.417664+03	2025-11-11 17:19:51.509516+03
129	28	\N	2	በሲስተም የተመዘገቡትን ይዞታዎች አገልገሎት በመስጠት ገቢ መሰብሰብ	\N	To Do	\N	{"በብር": "4950500"}	{"በብር": "10000000"}	{}	{"q1": 2000000, "q2": 3000000, "q3": 3000000, "q4": 2000000}	0	0.5	f	2025-10-13 06:57:31.599842+03	2025-11-11 17:20:59.741959+03
130	28	\N	3	የካዳስተርን ሽፋን ማሳደግ	\N	To Do	\N	{"በመቶኛ": "16"}	{"በመቶኛ": "60"}	{}	{"q2": 35, "q4": 60}	0	0.5	f	2025-10-13 06:57:55.286776+03	2025-11-11 17:22:03.386055+03
134	29	\N	4	በክልሉ የሪል ፕሮፐርቲ ግብይት ግመታና ፈቃድ አሰጣጥ ስርዓት አደረጃጀት እንዲፈጠር ማድረግ (ፈቃድ በክልል ደረጃ እና በፌደራል ደረጃ ይሰጣል ስለዚህ በክልል እንዲሰጠጥ ማድረግ)	\N	To Do	\N	{}	{"በቄጥር": "1"}	{}	{"q3": 1}	0	0.166	f	2025-10-13 07:00:42.446764+03	2025-11-12 21:37:21.204444+03
132	29	\N	2	በከተሞች የሪል ንብረቶች ዋጋ ግመታ በማካሄድ ገቢ መሰብሰብ፣	\N	To Do	\N	{}	{"በብር": "200000000"}	{}	{"q1": 40000000, "q2": 60000000, "q3": 60000000, "q4": 40000000}	0	0.5	f	2025-10-13 06:59:40.775222+03	2025-11-12 21:35:31.562124+03
133	29	\N	3	በከተሞች የሪል ንብረቶች ዋጋ ግመታ በማካሄድ ሽፋኑን 70 በመቶ ማድረስ፣	\N	To Do	\N	{"በመቶኛ": "10"}	{"በመቶኛ": "70"}	{}	{"q2": 45, "q4": 90}	0	0.5	f	2025-10-13 07:00:14.179317+03	2025-11-12 21:36:00.428269+03
135	29	\N	5	የሪል ፕሮፐርቲ ዳታ ቤዝ ማልማት	\N	To Do	\N	{}	{"በቄጥር": "1"}	{}	{"q2": 1}	0	0.167	f	2025-10-13 07:02:18.660231+03	2025-11-12 21:37:38.371353+03
136	29	\N	6	የክልሉ መረጃ በሀገር ዓቀፍ ደረጃ በለማው የሪል ፕሮፐርቲ ፕላትፎርምና ኦብዘርቫቶሪ ሲስተም ላይ እንዲጫን ይደረጋል	\N	To Do	\N	{}	{"በቄጥር": "1"}	{}	{"q4": 1}	0	0.167	f	2025-10-13 07:02:48.556261+03	2025-11-12 21:37:49.079934+03
137	30	\N	1	የተሰጠ የፕላን ስምምነት	\N	To Do	\N	{"በቁጥር": "591"}	{"በቁጥር": "1600"}	{}	{"q1": 320, "q2": 480, "q3": 480, "q4": 320}	0	1	f	2025-10-13 07:04:16.66232+03	2025-11-12 21:39:14.034735+03
139	30	\N	3	የተሰጠ የግንባታ ፍቃድ ማሻሻያ ፍቃድ	\N	To Do	\N	{"በቁጥር": "8"}	{"በቁጥር": "15"}	{}	{"q1": 3, "q2": 5, "q3": 4, "q4": 3}	0	0.5	f	2025-10-13 07:05:55.502057+03	2025-11-12 21:40:44.34804+03
138	30	\N	2	የተሰጠ አዲስ የግንባታ ፍቃድ	\N	To Do	\N	{"በቁጥር": "581"}	{"በቁጥር": "1200"}	{}	{"q1": 240, "q2": 360, "q3": 360, "q4": 240}	0	1	f	2025-10-13 07:05:19.504344+03	2025-11-12 21:40:10.881976+03
141	30	\N	5	የተሰጠ የግንባታ እድሳት ፍቃድ	\N	To Do	\N	{"በቁጥር": "95"}	{"በቁጥር": "355"}	{}	{"q1": 70, "q2": 108, "q3": 107, "q4": 70}	0	1	f	2025-10-13 07:06:48.894887+03	2025-11-12 21:41:50.844394+03
144	31	\N	3	የወቅታዊ የግንበታ ገበያ ዋጋ ጥናት ማድረግ	\N	To Do	\N	{"በሰነድ": "3"}	{"በሰነድ": "4"}	{}	{"q1": 1, "q2": 1, "q3": 1, "q4": 1}	0	0.5	f	2025-10-13 07:08:13.817137+03	2025-11-12 21:43:12.380257+03
146	31	\N	5	4 የኮንስትራክሽን መሪ መዛኞችን በማፍራት 100 አነስተኛ እና መለስተኛ ባለሙያዎች ብቃታቸው በምዘና እንዲረጋገጥ ይደረጋል፡፡	\N	To Do	\N	{}	{"መሪ መዛኝ በቁጥር": "4"}	{}	{"q2": 4}	0	0.5	f	2025-10-13 07:09:02.473947+03	2025-11-12 21:44:05.687444+03
147	31	\N	6	No Name/ስም የለም/Tihariho eiziina	\N	To Do	\N	{}	{"በምዘና የተረጋገጠ ባለሙያ በቁጥር": "100"}	{}	{"q3": 50, "q4": 50}	0	0.5	f	2025-10-13 07:12:07.105024+03	2025-11-12 21:44:39.083322+03
148	32	\N	1	የህንፃ፣የመንገድ ዳር እና የውጭ ማስታወቂያ ፈቃድ መስጠት (አዲስ እና ነባር)	\N	To Do	\N	{"በቁጥር": "11"}	{"በቁጥር": "150"}	{}	{"q1": 30, "q2": 45, "q3": 45, "q4": 30}	0	1	f	2025-10-13 07:13:03.160837+03	2025-11-12 21:45:09.375966+03
149	32	\N	2	የማስታወቂያ ተከላ ክትትልና ቁጥጥር ማድረግ	\N	To Do	\N	{"በቁጥር": "104"}	{"በቁጥር": "150"}	{}	{"q1": 30, "q2": 45, "q3": 45, "q4": 30}	0	0.5	f	2025-10-13 07:13:29.701279+03	2025-11-12 21:45:28.016368+03
150	33	\N	1	የተሰጠ የግንባታ እርከን ማሳወቂያ	\N	To Do	\N	{"በቁጥር": "38"}	{"በቁጥር": "142"}	{}	{"q1": 20, "q2": 30, "q3": 30, "q4": 20}	0	0.5	f	2025-10-13 07:17:08.442513+03	2025-11-12 21:46:03.981541+03
152	33	\N	3	ተጀምረው ያልተጠናቀቁ እና አዲስ ግንባታ ፕሮጀክቶች ክትትልና ቁጥጥር ማድረግ	\N	To Do	\N	{"በፕሮጀክት ቁጥር": "142"}	{"በፕሮጀክት ቁጥር": "154"}	{}	{"q1": 31, "q2": 46, "q3": 46, "q4": 31}	0	0.5	f	2025-10-13 07:17:59.693732+03	2025-11-12 21:46:56.879469+03
153	33	\N	4	የማስተካከያ ትዕዛዝ የተሰጠባቸዉና የተስተካከሉ ፕሮጀክቶች	\N	To Do	\N	{"በቁጥር": "38"}	{"በቁጥር": "100"}	{}	{"q1": 20, "q2": 30, "q3": 30, "q4": 20}	0	0.5	f	2025-10-13 07:18:24.412899+03	2025-11-12 21:47:20.079687+03
155	33	\N	6	ሙለ ለሙለ ለተጠናቀቁ ሕንፃዎች የተሰጠ መጠቀሚያ ፍቃድ የመንግስት አገልግሎት መስጫ ተቋማትን ጨምሮ	\N	To Do	\N	{"በቁጥር": "6"}	{"በቁጥር": "15"}	{}	{"q1": 3, "q2": 5, "q3": 4, "q4": 3}	0	1	f	2025-10-13 07:19:15.99596+03	2025-11-12 21:48:08.080836+03
156	33	\N	7	ክትትልና ቁጥጥር የተደረገባቸዉ ግንባታ ፕሮጀክቶች ሽፋን ማሳደግ	\N	To Do	\N	{"በመቶኛ": "0"}	{"በመቶኛ": "100"}	{}	{"q1": 28, "q2": 43, "q3": 43, "q4": 28}	0	0.5	f	2025-10-13 07:19:38.773331+03	2025-11-12 21:48:33.587047+03
157	34	\N	1	ለቀረቡ የመረጃ ጥያቄዎች የተሰጡ ምላሾች	\N	To Do	\N	{"በመቶኛ": "70"}	{"በመቶኛ": "100"}	{}	{"q4": 100}	0	0.75	f	2025-10-13 07:20:31.695958+03	2025-11-12 21:49:07.318105+03
159	35	\N	1	ዲጅታላይዝ የተደረገ የመረጃ ቋት	\N	To Do	\N	{"በመቶኛ": "38"}	{"በመቶኛ": "100"}	{}	{"q4": 100}	0	0.5	f	2025-10-13 07:21:59.203209+03	2025-11-12 21:50:07.870464+03
160	35	\N	2	በኤላክትሮኒክስ ተደራሽ የሆነ አገልግሎት	\N	To Do	\N	{"በመቶኛ": "0"}	{"በመቶኛ": "50"}	{}	{"q2": 25, "q4": 25}	0	0.5	f	2025-10-13 07:22:23.714222+03	2025-11-12 21:50:25.180837+03
163	36	\N	3	በገጠር የልማት ማዕከላት ደረጃቸውን ጠብቀው የተገነቡ ቤቶች	\N	To Do	\N	{"በቁጥር": "0"}	{"በቁጥር": "90"}	{}	{"q2": 45, "q3": 45}	0	0.25	f	2025-10-13 07:24:10.192894+03	2025-11-12 22:08:38.068322+03
164	36	\N	4	በዘመናዊ መረጃ ስርዓት የመንግስት ቤት መረጃ መያዝ	\N	To Do	\N	{"በቁጥር": "465"}	{"በቁጥር": "1000"}	{}	{"q1": 200, "q2": 300, "q3": 300, "q4": 200}	0	0.25	f	2025-10-13 07:24:37.532313+03	2025-11-12 22:09:24.805497+03
168	36	\N	8	ከ100/0 ቤቶች ቀሪ ክፍያ የሚሰበሰብ ገቢ (በግሉ ዘርፍ ለሚገነቡ ቤቶች አንዲቀርብ ማድረግ)	\N	To Do	\N	{"በብር": "20393867"}	{"በብር": "20000000"}	{}	{"q1": 4000000, "q2": 6000000, "q3": 6000000, "q4": 4000000}	0	0.25	f	2025-10-13 07:28:48.291873+03	2025-11-12 22:14:27.627684+03
166	36	\N	6	በመንግስት አስተባባሪነት ለሚገነቡ ቤቶች 50 ሚሊዮን ብር አንዲቀርብ ማድረግ	\N	To Do	\N	{"በሚሊዮን ብር": ""}	{"በሚሊዮን ብር": "50"}	{}	{"q1": 10, "q2": 15, "q3": 15, "q4": 10}	0	0.25	f	2025-10-13 07:25:28.86415+03	2025-11-12 22:11:07.395593+03
167	36	\N	7	በመንግስት አስተባባሪነት የተገነቡ ቤቶች እንዲተላለፉ ማድረግ	\N	To Do	\N	{"none/ባዶ/busha": "0"}	{"none/ባዶ/busha": "6"}	{}	{"q2": 6}	0	0.25	f	2025-10-13 07:26:38.737526+03	2025-11-12 22:12:45.230906+03
169	36	\N	9	ከመምህራን ቤት ወርሃዊ ክፍያ የሚሰበሰበ ገቢ	\N	To Do	\N	{"በብር": "1750000"}	{"በብር": "1750000"}	{}	{"q1": 437500, "q2": 437500, "q3": 437500, "q4": 40}	0	0.25	f	2025-10-13 08:47:49.899293+03	2025-11-12 22:17:01.497367+03
170	36	\N	10	የአፓርታማ ቤት ግንባታ የሚሰበሰብ ገንዘብ	\N	To Do	\N	{"በብር": "0"}	{"በብር": "30000000"}	{}	{"q1": 6000000, "q2": 9000000, "q3": 9000000, "q4": 4000000}	0	0.25	f	2025-10-13 08:49:14.157206+03	2025-11-12 22:20:04.386946+03
172	36	\N	12	በግለሰቦች የቤት ልማት አቅርቦት ፕሮግራም ቤቶች እንዲገነቡ ማድረግ	\N	To Do	\N	{"በቁጥር": "498"}	{"በቁጥር": "1200"}	{}	{"q1": 240, "q2": 360, "q3": 360, "q4": 240}	0	0.25	f	2025-10-13 08:52:13.800947+03	2025-11-12 22:20:47.352539+03
173	36	\N	13	በሪል ስቴት የቤት ልማት አቅርቦት ፕሮግራም 50 ቤቶች መገንባት	\N	To Do	\N	{"በቁጥር": "0"}	{"በቁጥር": "50"}	{}	{"q1": 10, "q2": 15, "q3": 15, "q4": 10}	0	0.25	f	2025-10-13 08:52:42.965634+03	2025-11-12 22:21:20.350313+03
175	36	\N	15	በመልሶ ማልማት ቤቶች እንዲገነቡ ማድረግ	\N	To Do	\N	{"በቁጥር": "0"}	{"በቁጥር": "230"}	{}	{"q1": 46, "q2": 50, "q3": 80, "q4": 54}	0	0.25	f	2025-10-13 08:53:51.34042+03	2025-11-12 22:22:22.416941+03
176	36	\N	16	በማሻሻያ (በእድሳት) ልማት ደረጃቸው እንዲሻሻል ማድረግ	\N	To Do	\N	{"በቁጥር": ""}	{"በቁጥር": "300"}	{}	{"q1": 250, "q4": 50}	0	0.25	f	2025-10-13 08:54:21.699058+03	2025-11-12 22:22:47.298696+03
177	37	\N	1	የፕሮጀክት ሙሉ ዲዛይኖች ማዘጋጀት	\N	To Do	\N	{"በቁጥር": "8"}	{"በቁጥር": "12"}	{}	{"q1": 6, "q2": 6}	0	1	f	2025-10-13 08:55:31.814033+03	2025-11-12 22:23:16.077848+03
187	38	\N	6	ርክክብ የሚደረጉ ፕሮጀክቶች	\N	To Do	\N	{}	{"በቁጥር": "15"}	{}	{}	0	0.5	f	2025-10-13 09:04:57.160865+03	2025-10-13 09:04:57.160865+03
5	6	\N	1	ወቅቱንና ጥራቱን የጠበቀ ዕቅድ ማዘጋጅት	\N	To Do	\N	{"በቁጥር": "3"}	{"በቁጥር": "5"}	{}	{"q1": 2, "q2": 1, "q3": 2}	0	0.5	f	2025-10-13 00:01:57.796106+03	2025-11-11 15:12:19.381208+03
20	8	\N	7	ወቅቱን እና ጥራቱን የጠበቀ የኦዲት ሪፖርት	\N	To Do	\N	{"በሰነድ": "4"}	{"በሰነድ": "4"}	{}	{"q1": 1, "q2": 1, "q3": 1, "q4": 1}	0	0.04	f	2025-10-13 00:34:34.58016+03	2025-11-11 15:36:01.480599+03
33	10	\N	3	መረጃዎችን በተለያዩ የተግባቦት ዘዴዎች ተደራሽ ማድረግ	\N	To Do	\N	{"በመቶኛ": "100"}	{"በመቶኛ": "100"}	{}	{"q1": 100, "q2": 100, "q3": 100, "q4": 100}	0	0.5	f	2025-10-13 00:43:47.064961+03	2025-11-11 15:45:33.589642+03
45	13	\N	3	ሥልጠና ያገኙ ሴት ሰራተኞች ድርሻ ማሳደግ	\N	To Do	\N	{"በመቶኛ": "80"}	{"በመቶኛ": "100"}	{}	{"q1": 85, "q2": 90, "q3": 95, "q4": 100}	0	0.25	f	2025-10-13 00:57:43.590798+03	2025-11-11 15:54:00.168475+03
178	37	\N	2	የፕሮጀክት BOQ እና ነጠላ ዋጋ ግምት ማዘጋጃት	\N	To Do	\N	{"በቁጥር": ""}	{"በቁጥር": "10"}	{}	{"q1": 2, "q2": 3, "q3": 3, "q4": 2}	0	0.5	f	2025-10-13 08:55:56.17943+03	2025-11-12 22:23:38.56312+03
180	37	\N	4	ለመኖ/ህ/ስ/ማህበራት እና ለገጠር ቤቶች ልማት   ስታንዳርድ ዲዛይኖች ማዘጋጀት	\N	To Do	\N	{"ለከተማ በማህበራት የተዘጋጀ ዲዛይን በቁጥር": "0"}	{"ለከተማ በማህበራት የተዘጋጀ ዲዛይን በቁጥር": "1"}	{}	{"q2": 1}	0	0.25	f	2025-10-13 08:57:05.386604+03	2025-11-12 22:26:19.789977+03
181	37	\N	5	ለመኖ/ህ/ስ/ማህበራት እና ለገጠር ቤቶች ልማት   ስታንዳርድ ዲዛይኖች ማዘጋጀት	\N	To Do	\N	{"ለገጠር ቤቶች የተዘጋጀ ዲዛይን በቁጥር": "0"}	{"ለገጠር ቤቶች የተዘጋጀ ዲዛይን በቁጥር": "1"}	{}	{"q2": 1}	0	0.25	f	2025-10-13 08:58:00.96911+03	2025-11-12 22:26:59.690669+03
185	38	\N	5	በተያዘላቸዉ ጊዜ፣ በጀትና ጥራት የሚጠናቀቁ ፕሮጀክቶች ብዛት	\N	To Do	\N	{}	{"በቁጥር": "12"}	{}	{}	0	1	f	2025-10-13 09:01:58.046427+03	2025-11-12 22:37:05.923299+03
182	38	\N	2	የተጠናቀቀ የጨረታ ሒደት	\N	To Do	\N	{"በቁጥር": "7"}	{"በቁጥር": "9"}	{}	{"q1": 4, "q2": 5}	0	1	f	2025-10-13 08:59:59.882577+03	2025-11-12 22:37:38.418971+03
184	38	\N	4	ክትትልና ቁጥጥር የሚደረግባቸው ፕሮጀክቶች	\N	To Do	\N	{}	{"በቁጥር": "22"}	{}	{}	0	1	f	2025-10-13 09:01:05.706179+03	2025-11-12 22:37:15.926339+03
183	38	\N	3	በጨረታ ሰነድ መሰረት የሚታሰሩ ውሎች	\N	To Do	\N	{"በቁጥር": "7"}	{"በቁጥር": "9"}	{}	{"q1": 9}	0	0.5	f	2025-10-13 09:00:32.909825+03	2025-11-12 22:37:29.751103+03
188	39	\N	1	በመኖሪያ ቤቶች ቆጠራ (Inventory) ወቅት የተገኙ ግኝቶችን መፍትሄ መስጠት	\N	To Do	\N	{"በቁጥር": "3"}	{"በቁጥር": "3"}	{}	{"q1": 2, "q2": 1}	0	1	f	2025-10-27 06:55:45.246543+03	2025-11-12 22:48:47.005092+03
189	39	\N	2	ኤጀንሲው የሚያስተዳድራቸውን ኮንዶምኒየም ቤቶች አመታዊ ቆጠራ ማድረግ	\N	To Do	\N	{"በቁጥር": ""}	{"በቁጥር": "166"}	{}	{"q1": 66, "q2": 100}	0	0.75	f	2025-10-27 06:56:46.976513+03	2025-11-12 22:49:24.422975+03
190	39	\N	3	ኤጀንሲው የሚያስተዳድራቸውን ንግድ ቤቶች አመታዊ ቆጠራ ማድረግ	\N	To Do	\N	{"በቁጥር": ""}	{"በቁጥር": "343"}	{}	{"q2": 280, "q3": 63}	0	0.75	f	2025-10-27 06:57:33.526824+03	2025-11-12 22:50:03.504639+03
192	39	\N	5	ነባር መመሪያን አሻሽሎ ለቦርድ በማቅረብ ማስወሰን	\N	To Do	\N	{"በሰነድ": ""}	{"በሰነድ": "1"}	{}	{"q1": 1}	0	0.75	f	2025-10-27 06:58:40.763939+03	2025-11-12 22:51:51.799827+03
193	39	\N	6	ተከራይ ደንበኛ አዲስ የተሻሻለውን ውል እንዲሞሉ ማድረግ	\N	To Do	\N	{"በቁጥር": ""}	{"በቁጥር": "1283"}	{}	{"q1": 1000, "q2": 283}	0	0.75	f	2025-10-27 06:59:41.593974+03	2025-11-12 22:53:05.742435+03
194	39	\N	7	በይዞታዎቻችን ላይ ሊፈጸሙ የሚችሉትን ህገ-ወጥ ድርጊቶችን ክትትል ማድረግ	\N	To Do	\N	{"በወር": ""}	{"በወር": "12"}	{}	{"q1": 3, "q2": 3, "q3": 3, "q4": 3}	0	0.75	f	2025-10-27 07:00:13.078677+03	2025-11-12 22:53:43.911819+03
195	39	\N	8	ኤጃንሲው ከሚያስተዳድራቸው ቤቶች አመታዊ ገቢ መሰብሰብ	\N	To Do	\N	{"በብር": "14626326"}	{"በብር": "1874571500"}	{}	{"q1": 3749143, "q2": 5623714, "q3": 5623714, "q4": 2749143}	0	1	f	2025-10-27 07:02:38.59653+03	2025-11-12 22:55:22.34703+03
196	39	\N	9	ሁለት የክፍያ አማራጭ ስርዓትን በመዘርጋት አሰራርን ማዘመን	\N	To Do	\N	{"በክፍያ አማራጭ ብዛት": ""}	{"በክፍያ አማራጭ ብዛት": "2"}	{}	{"q2": 1, "q3": 1}	0	0.4	f	2025-10-27 07:03:25.06928+03	2025-11-12 22:55:52.026029+03
198	40	\N	1	ከባለሀብቶች ጋር በመጣመር በኤጀንሲው ይዞታ ላይ ቅይጥ አገልግሎት የሚሰጡ ህንፃዎችን መገንባት	\N	To Do	\N	{"በቁጥር": ""}	{"በቁጥር": "3"}	{}	{"q4": 3}	0	0.5	f	2025-10-27 07:06:39.325377+03	2025-11-12 22:57:37.957493+03
199	40	\N	2	በኤጀንሲው ይዞታ ላይ B+G+4 የጋራ መኖሪያ ኮንዶሚኒየም ህንጻ መገንባት	\N	To Do	\N	{"በቁጥር": ""}	{"በቁጥር": "1"}	{}	{"q4": 1}	0	0.5	f	2025-10-27 07:07:30.771127+03	2025-11-12 22:57:53.481488+03
200	40	\N	3	መኖሪያ ቤቶችን ለተከራይ ደንበኞች በሽያጭ ለማስተላለፍ የተሰራውን ጥናት ለቦርድ አቅርቦ ማፀደቅ	\N	To Do	\N	{"በሰነድ": ""}	{"በሰነድ": "1"}	{}	{"q1": 1}	0	0.25	f	2025-10-27 07:08:15.39037+03	2025-11-12 22:58:55.350486+03
201	40	\N	4	የቀድሞ ሲቪል ሰርቪስ ቢሮ ምድር ላይ ያሉትን አራት የፅ/ቤት ክፍሎችን ወደ ንግድ ቤት መቀየር	\N	To Do	\N	{"በቁጥር": "0"}	{"በቁጥር": "4"}	{}	{"q2": 4}	0	0.25	f	2025-10-27 07:09:00.747005+03	2025-11-12 22:59:20.71196+03
202	40	\N	5	ለወሳኝ ኩነት ቢሮ አጥርና ቢሮ መገንባት	\N	To Do	\N	{"በቁጥር": ""}	{"በቁጥር": "1"}	{}	{"q1": 1}	0	0.5	f	2025-10-27 07:10:09.522633+03	2025-11-12 22:59:48.183998+03
203	40	\N	6	ለምናስተዳድራቸው ቤቶች ጥገና እና እድሳት ማድረግ	\N	To Do	\N	{"በቁጥር": "20"}	{"በቁጥር": "20"}	{}	{"q1": 3, "q2": 7, "q3": 7, "q4": 3}	0	0.5	f	2025-10-27 07:11:10.382417+03	2025-11-12 23:00:13.030106+03
6	6	\N	2	ወቅቱንና ጥራቱን የጠበቀ ሪፖርት ማዘጋጀት	2 የተቀነሰው የሐምሌ እና ነሀሴ ካፒታል ፕሮጀክት ሪፖርት ስለሌለ ነው የ2017 ፊዚካል እና ፋይናንሺያል አፈጻጸማችንን ሰኔ ላይ አጠናቀን አስገብተናል ፋይናንሺያል ግሬስ ፔሬድ ላይ የነበረው በሰኔ ነው የሚያዘው 10 በየዉ ካፒታል ፕሮጀክት እና 4 መደበኛ ሪፖርት	To Do	\N	{"በሰነድ": "10"}	{"በሰነድ": "14"}	{}	{"q1": 2, "q2": 4, "q3": 4, "q4": 4}	0	0.5	f	2025-10-13 00:11:01.479628+03	2025-11-11 15:12:51.548642+03
24	8	\N	11	አመታዊ የቋሚ ንብረት መግለጫ (አስ) ማዘጋጀት	\N	To Do	\N	{"በሰነድ": "1"}	{"በሰነድ": "1"}	{}	{"q1": 1}	0	0.25	f	2025-10-13 00:37:44.654486+03	2025-11-11 15:38:50.277004+03
38	11	\N	5	የተቋሙን/የቢሮዉን እና የወረዳን አፈጻጸም በየሩብ ዓመቱ በጋራ መገምገም	\N	To Do	\N	{"በቁጥር": "3"}	{"በቁጥር": "4"}	{}	{"q1": 1, "q2": 1, "q3": 1, "q4": 1}	0	0.1	f	2025-10-13 00:47:19.684299+03	2025-11-11 15:49:44.377757+03
49	14	\N	3	የአረንጓዴ አሻራ ተግባራትን ክብካቤ የተደረገለት ችግኝ	\N	To Do	\N	{"በቁጥር": "1000"}	{"በቁጥር": "1602"}	{}	{"q1": 1602, "q2": 1522, "q3": 1446, "q4": 1361}	0	0.15	f	2025-10-13 05:45:10.93995+03	2025-11-11 15:59:34.575254+03
57	14	\N	11	ወላጆቻቸውን ያጡ ህፃናትን መደገፍ በገንዘብ\t0.2\t\t20,000\t20,000	\N	To Do	\N	{"በብር": "20000"}	{"በብር": "20000"}	{}	{"q3": 20000}	0	0.02	f	2025-10-13 06:00:56.693034+03	2025-11-11 16:09:02.814799+03
68	16	\N	1	ገጠር ከገጠር እና ገጠር ከከተማ የትስስር ጥናት ማዘጋጀት	\N	To Do	\N	{"በሰነድ": "0"}	{"በሰነድ": "2"}	{}	{"q2": 1, "q4": 1}	0	0.5	f	2025-10-13 06:17:10.196197+03	2025-11-11 16:22:32.988146+03
76	17	\N	4	የቅርስ ጥበቃ ፕላን ትግበራ ላይ ክትትልና ቁጥጥር ማድረግ	\N	To Do	\N	{"በሰነድ": "2"}	{"በሰነድ": "2"}	{}	{"q2": 1, "q4": 1}	0	0.5	f	2025-10-13 06:21:04.377334+03	2025-11-11 16:28:30.669607+03
90	20	\N	3	መሬት ባንክ ገቢ ማድረግ	\N	To Do	\N	{"በሄክታር": "41"}	{"በሄክታር": "50"}	{}	{"q1": 10, "q2": 15, "q3": 15, "q4": 10}	0	0.75	f	2025-10-13 06:29:43.256245+03	2025-11-11 16:39:02.499016+03
96	21	\N	5	አስተዳደራዊ አገልግሎት የተላለፈ መሬት	\N	To Do	\N	{"በሄክታር": "6"}	{"በሄክታር": "4"}	{}	{"q1": 0.2, "q2": 0.3, "q3": 0.3, "q4": 0.2}	0	0.75	f	2025-10-13 06:33:09.188212+03	2025-11-11 16:43:56.39455+03
102	22	\N	2	የመሬት ህገወጥ ይዞታዎችን ማስለቀቅ	\N	To Do	\N	{"በሄክታር": ""}	{"በሄክታር": "1"}	{}	{"q1": 0.25, "q2": 0.25, "q3": 0.25, "q4": 0.25}	0	0.25	f	2025-10-13 06:36:11.257031+03	2025-11-11 16:49:51.328289+03
110	24	\N	2	ካደስተር ምዝገባዉ ተደራሽ ማድረግ	\N	To Do	\N	{"በቁጥር": "7600"}	{"በቁጥር": "15000"}	{}	{"q1": 2500, "q2": 3750, "q3": 3750, "q4": 2500}	0	0.75	f	2025-10-13 06:43:29.910991+03	2025-11-11 17:03:23.642741+03
114	25	\N	4	ከመብት ፈጣሪ ተቋም (መሬት ልማት ማኔጅመንት) የተደራጁ የይዞታ ፋይሎችን በደንቡ መሰረት መረከብ	\N	To Do	\N	{"በተረከበ ፋይል ቁጥር": "7640"}	{"በተረከበ ፋይል ቁጥር": "15000"}	{}	{"q1": 3000, "q2": 4500, "q3": 4500, "q4": 3000}	0	0.5	f	2025-10-13 06:46:51.232712+03	2025-11-11 17:06:35.249926+03
122	26	\N	4	የመሬት ይዞታ ማህደሮች ከኦርቶፎቶ/ከካዳስተር መሰረታዊ ካርታ ጋር በቁራሽ መሬት ልዩ ኮድ እንዲተሳሰሩ ማድረግ	\N	To Do	\N	{"በይዞታ ቁጥር": ""}	{"በይዞታ ቁጥር": "15000"}	{}	{"q1": 3000, "q2": 4500, "q3": 4500, "q4": 3000}	0	0.25	f	2025-10-13 06:51:44.855428+03	2025-11-11 17:13:21.412638+03
131	29	\N	1	በከተሞች ለንብረት ግመታ የከተማ ቦታ ደረጃ መመሪያ እና የከተማ ቦታና ቤት ግብር ደንብ ማሻሻል ፣	\N	To Do	\N	{"በሰነድ": "1"}	{"በሰነድ": "2"}	{}	{"q1": 1, "q2": 1}	0	0.5	f	2025-10-13 06:59:04.584181+03	2025-11-12 21:37:56.347325+03
145	31	\N	4	በክልሉ የነጠላ ግመታ መረጃ በማደራጀት (ለንብረት ዝውውር፤ ለካሳ እና ለባንክ እዳና እገዳ) አገልግሎት እንዲውል ማድረግ	\N	To Do	\N	{}	{"በሰነድ": "1"}	{}	{"q2": 1}	0	0.5	f	2025-10-13 07:08:32.255733+03	2025-11-12 21:43:49.385496+03
161	36	\N	1	ለመኖሪያ ቤት ግንባታ የሚሆን 10 ሄክታር የለማ መሬት እንዲዘጋጅ ማድረግ	\N	In Progress	\N	{"በሄክታር": "0"}	{"በሄክታር": "10"}	{"ahdg": "ukweh"}	{"q1": 6, "q2": 4}	0	0.5	f	2025-10-13 07:23:27.347002+03	2025-11-12 22:07:48.848367+03
162	36	\N	2	ለመኖሪያ ቤት ግንባታ የሚሆን የግንባታ ስምምነት ፍቃድ እንዲያገኙ ማድረግ	\N	To Do	\N	{"በቁጥር": "0"}	{"በቁጥር": "12"}	{}	{"q1": 6, "q2": 4, "q3": 2}	0	0.5	f	2025-10-13 07:23:50.494187+03	2025-11-12 22:08:12.439186+03
171	36	\N	11	በመኖሪያ ቤት ህብረት ሥራ ማኀበራት የቤት ልማት አቅርቦት ፕሮግራም ቤቶች እንዲገነቡ ማድረግ	\N	To Do	\N	{"በቁጥር": "0"}	{"በቁጥር": "120"}	{}	{"q2": 24, "q3": 56, "q4": 40}	0	0.25	f	2025-10-13 08:51:44.475418+03	2025-11-12 22:19:07.10027+03
179	37	\N	3	ባለቤት መስሪያ ቤቶች የፕሮጀክቶቻቸውን ዲዛይን እንዲያጸድቁ ተዘጋጅቶ የተላከላቸው የፕሮጀክታቸው ዲዛይኖች	\N	To Do	\N	{"በቁጥር": "5"}	{"በቁጥር": "9"}	{}	{"q1": 6, "q2": 3}	0	0.5	f	2025-10-13 08:56:31.381858+03	2025-11-12 22:25:14.794716+03
206	38	\N	18	በፕሮጀክቶች ግንባታ ቋሚና የሥራ ዕድል የሚፈጠርላቸው ሰዎች	\N	To Do	\N	{"በቁጥር": "3613"}	{"በቁጥር": "4000"}	{}	{"q1": 800, "q2": 1200, "q3": 1200, "q4": 800}	0	0.5	f	2025-11-12 22:39:14.307113+03	2025-11-12 22:39:14.307113+03
208	38	\N	20	በተያዘላቸዉ ጊዜ፣ በጀትና ጥራት የተጠናቀቁ ፕሮጀክቶች ሽፋን ማሳደግ	\N	To Do	\N	{"በመቶኛ": "80"}	{"በመቶኛ": "90"}	{}	{"q4": 90}	0	0.5	f	2025-11-12 22:40:48.767483+03	2025-11-12 22:40:48.767483+03
209	41	\N	21	የኮንስትራክሽን የላቦራቶሪ አገልግሎት መስጠት	\N	To Do	\N	{"በቁጥር": "63"}	{"በቁጥር": "100"}	{}	{"q1": 20, "q2": 30, "q3": 30, "q4": 20}	0	1	f	2025-11-12 22:42:31.444152+03	2025-11-12 22:42:31.444152+03
210	41	\N	22	ከተሰጡ የኮንስትራክሽን የላቦራቶሪ አገልግሎቶችን የተገኘ ገቢ	\N	To Do	\N	{"በብር": "0.8000000"}	{"በብር": "1000000"}	{}	{"q1": 200000, "q2": 300000, "q3": 300000, "q4": 200000}	0	1	f	2025-11-12 22:47:38.659512+03	2025-11-12 22:47:38.659512+03
191	39	\N	4	መኖሪያ ቤቶች፣ መንግስታዊና መንግታዊ ያልሆኑ ተቋም ኪራይ ተመን ማሻሻያ ጥናት አስወስኖ ወደ ትግበራ መግባት	\N	To Do	\N	{"በሰነድ": ""}	{"በሰነድ": "2"}	{}	{"q1": 1, "q2": 1}	0	0.75	f	2025-10-27 06:58:12.354831+03	2025-11-12 22:51:02.763251+03
158	34	\N	2	ግንባታ ነክ መረጃ ማደራጀት	\N	To Do	\N	{"በሰነድ": "2"}	{"በሰነድ": "1"}	{}	{"q4": 1}	0	0.75	f	2025-10-13 07:20:57.091063+03	2025-11-12 21:49:23.992872+03
165	36	\N	5	በመንግስት አስተባባሪነት በኪራይ ወይም በባለቤትነት (ዝቅተኛ ገቢ ላላቸው ህብረተሰብ ክፍሎች/አፓርታማ) ቤቶች እንዲገነቡ ማድረግ	\N	To Do	\N	{"በቁጥር": "0"}	{"በቁጥር": "200"}	{}	{"q1": 40, "q2": 60, "q3": 60, "q4": 40}	0	0.25	f	2025-10-13 07:24:56.32478+03	2025-11-12 22:09:53.716804+03
14	8	\N	1	የተመደበ በጀት በአግባቡ ሥራ ላይ ማዋል	\N	To Do	\N	{"በመቶኛ": "100"}	{"በመቶኛ": "100"}	{}	{"q1": 100, "q2": 100, "q3": 100, "q4": 100}	0	0.5	f	2025-10-13 00:28:22.480822+03	2025-11-11 15:39:46.862191+03
29	9	\N	3	በተቋሙ የሚሰጠ አገልግሎቶችን ኦቶሜት ማድረግ	\N	To Do	\N	{"በመቶኛ": "55"}	{"በመቶኛ": "80"}	{}	{"q1": 60, "q2": 65, "q3": 75, "q4": 80}	0	0.25	f	2025-10-13 00:40:53.620338+03	2025-11-11 15:42:43.269736+03
41	12	\N	3	በቴክኖሎጂ የተደገፈ መሰረታዊ አገልግሎትን በቅልጥፍና በመስጠት የደንበኞችን እርካታ ማሻሻል	\N	To Do	\N	{"በመቶኛ": "65"}	{"በመቶኛ": "75"}	{}	{"q4": 75}	0	0.5	f	2025-10-13 00:53:31.031902+03	2025-11-11 15:51:42.730087+03
53	14	\N	7	የአቅመ ደካማ ቤተሰብ ተማሪዎች ድጋፍ በገንዘብ	\N	To Do	\N	{"በብር": "165000"}	{"በብር": "400000"}	{}	{"q1": 100000, "q2": 100000, "q3": 100000, "q4": 100000}	0	0.15	f	2025-10-13 05:49:09.89982+03	2025-11-11 16:04:50.189687+03
62	15	\N	5	የፕላን ክፍሎችን፣ የማጠቃለያ ሰነዶችንና አሰራር ስታንደርዶችን ማሳተም	\N	To Do	\N	{"በሰነድ": "20"}	{"በሰነድ": "1"}	{}	{"q2": 1}	0	0.5	f	2025-10-13 06:13:44.555219+03	2025-11-11 16:18:10.200167+03
72	16	\N	5	የከተማ ፕላን ዝግጅትና ትግበራን ለማስፈፀም በተዘጋጁ ማኑዋሎች፣ ስታንዳርዶችና የአሰራር ስርአቶች ለባለሙያዎች (50% ሴቶች) ተግባር ተኮር የሆነ ስልጠና ይሰጣል፡፡	\N	To Do	\N	{"በሰልጣኝ በቁጥር": ""}	{"በሰልጣኝ በቁጥር": "20"}	{}	{"q2": 20}	0	0.5	f	2025-10-13 06:19:01.438362+03	2025-11-11 16:25:46.208803+03
78	17	\N	6	ባለድርሻ ተቋማት በመዋቅራዊ ፕላን ትግበራ የመልሶ ማልማት ፤የቤቶች ልማት፤የቅርስ ጥበቃና የመንገድ መረበብ የትግበራ ፕሮፖዛል በመለየት ከፕሮፖዛሎች አንፃር ስራቸውን ማከናወን በሚያስችል የስራ ትብብር ዙሪያ መግባቢያ ሰነድ መፈራረም	\N	To Do	\N	{"በሰነድ": "4"}	{"በሰነድ": "4"}	{}	{"q1": 4}	0	0.5	f	2025-10-13 06:21:57.101224+03	2025-11-11 16:29:28.386825+03
93	21	\N	2	ለመኖሪያ ቤት የተላለፈ መሬት	\N	To Do	\N	{"በሄክታር": "6.05"}	{"በሄክታር": "14"}	{}	{"q1": 2.8, "q2": 4.2, "q3": 4.2, "q4": 2.8}	0	0.75	f	2025-10-13 06:31:49.937113+03	2025-11-11 16:41:27.930484+03
98	21	\N	7	ለመንገድ፣ ትራንስፖርትና ዩቲሉቲ ልማት አገልግሎት የተላለፈ መሬት	\N	To Do	\N	{"በሄክታር": "6"}	{"በሄክታር": "6"}	{}	{"q1": 1.2, "q2": 1.8, "q3": 1.8, "q4": 1.2}	0	0.75	f	2025-10-13 06:34:00.428973+03	2025-11-11 16:45:21.775987+03
105	22	\N	5	በክልሉ 5,000 በቁራሽ መሬት (10 ሄክታር) ላይ የሚገኝ የመሬት ሀብታቸውን ቆጥረውና መዝግበው ወቅታዊ እንዲያደርጉና እንዲያስተዳድሩ ይደረጋል	\N	To Do	\N	{"በቁራሽ መሬት ብዛት": "5000"}	{"በቁራሽ መሬት ብዛት": "1000"}	{}	{"q1": 1000, "q2": 1500, "q3": 1500, "q4": 1000}	0	0.25	f	2025-10-13 06:38:03.636168+03	2025-11-11 16:55:43.960766+03
111	25	\N	1	የህጋዊ ካዳስተር ስርዓትን ለመተግበር የሚያስፈልጉ የሲስተም ፣ ማረጋገጥና ምዝገባ ግብአቶችን እንዲሟላ ስፔስፊኬሽን ሰነድ ማዘጋጀት	\N	To Do	\N	{"የስፔስፊኬሽን ሰነድ": "1"}	{"የስፔስፊኬሽን ሰነድ": "1"}	{}	{"q1": 1}	0	0.5	f	2025-10-13 06:44:56.524942+03	2025-11-11 17:04:18.761534+03
119	26	\N	1	በተመረጡ ቀጠናዎች ውስጥ ይዞታዎችን የወሰን ማካለል ስራ መስራት	\N	To Do	\N	{"በቁራሽ መሬት በቁጥር": "15000"}	{"በቁራሽ መሬት በቁጥር": "3000"}	{}	{"q1": 3000, "q2": 4500, "q3": 4500, "q4": 3000}	0	0.5	f	2025-10-13 06:49:36.429385+03	2025-11-11 17:10:27.662709+03
125	26	\N	7	ምዝገባ ለተደረገላቸው ይዞታዎች ለሚሰጡ አገልግሎቶች አገልግሎት አሰጣጡ ወጪና ጊዜ ቆጣቢ፣ ፈጣንና ተደራሽ እንዲሆን ክትትልና ድጋፍ ማድረግ	\N	To Do	\N	{"አገልግሎት ያገኙ ባለይዞታዎች በቁጥር": ""}	{"አገልግሎት ያገኙ ባለይዞታዎች በቁጥር": "6000"}	{}	{"q1": 1200, "q2": 1800, "q3": 1800, "q4": 1200}	0	0.25	f	2025-10-13 06:53:01.409408+03	2025-11-11 17:15:44.497132+03
140	30	\N	4	የተሰጠ የግንባታ ማራዘሚያ ፍቃድ	\N	To Do	\N	{"በቁጥር": "7"}	{"በቁጥር": "30"}	{}	{"q1": 7, "q2": 8, "q3": 8, "q4": 7}	0	0.5	f	2025-10-13 07:06:25.847443+03	2025-11-12 21:41:23.826922+03
142	31	\N	1	የተመዘገቡና ደረጃ የወጣላቸው የኮንስትራክሽን ፕሮጀክቶች	\N	To Do	\N	{"በቁጥር": "40"}	{"በቁጥር": "80"}	{}	{"q1": 16, "q2": 24, "q3": 24, "q4": 16}	0	0.5	f	2025-10-13 07:07:29.760392+03	2025-11-12 21:42:26.687394+03
143	31	\N	2	ለሥራ ተቋራጩች፣ለአማካሪዎች፣ባለሙያዎች፣መሳሪያ አከራዮችና ግብአት አምራቾች የተደረገ ምዝገባ ፍቃድ	\N	To Do	\N	{"በቁጥር": "52"}	{"በቁጥር": "100"}	{}	{"q1": 20, "q2": 30, "q3": 30, "q4": 20}	0	0.5	f	2025-10-13 07:07:52.057195+03	2025-11-12 21:42:49.02047+03
151	33	\N	2	የተሰጠ የግንባታ ግብአት ጥራት ማረጋገጫ ማስረጃ	\N	To Do	\N	{"በቁጥር": "50"}	{"በቁጥር": "154"}	{}	{"q1": 31, "q2": 46, "q3": 46, "q4": 31}	0	0.5	f	2025-10-13 07:17:37.083273+03	2025-11-12 21:46:26.365654+03
154	33	\N	5	በከፊል ለተጠናቀቁ ህንጻዎች የተሰጠ መጠቀሚያ ፍቃድ	\N	To Do	\N	{"በቁጥር": "13"}	{"በቁጥር": "30"}	{}	{"q1": 7, "q2": 8, "q3": 8, "q4": 7}	0	0.5	f	2025-10-13 07:18:51.207214+03	2025-11-12 21:47:47.209506+03
174	36	\N	14	በባለሀብቶች ቅይጥ ህንፃ የሚገነቡ ቤቶች (መረጃ ከከተማ ልማት የሚሰበሰብ)	\N	To Do	\N	{"በቁጥር": "0"}	{"በቁጥር": "50"}	{}	{"q1": 10, "q2": 15, "q3": 15, "q4": 10}	0	0.25	f	2025-10-13 08:53:08.656013+03	2025-11-12 22:21:47.273949+03
205	38	\N	1	የተዘጋጀ የጨረታ ሰነድ	\N	To Do	\N	{"በቁጥር": "7"}	{"በቁጥር": "9"}	{}	{"q1": 4, "q2": 5}	0	0.5	f	2025-11-12 22:31:17.164147+03	2025-11-12 22:36:07.653209+03
207	38	\N	19	በቤቶች ልማትና በመንግስት ኮንስትራክሽን ዙሪያ የሚደረጉ ጥናቶች	\N	To Do	\N	{"በሰነድ": "1"}	{"በሰነድ": "1"}	{}	{"q3": 1}	0	0.5	f	2025-11-12 22:40:08.489276+03	2025-11-12 22:40:08.489276+03
197	39	\N	10	ለቦርድ ቀርቦ የሚፀድቀውን የመኖሪያ ቤቶችን የሽያጭ ማስተላለፍ ጥናትን ተግባራዊ ማድረግ	\N	To Do	\N	{"በቁጥር": ""}	{"በቁጥር": "100"}	{}	{"q1": 30, "q2": 70}	0	0.01	f	2025-10-27 07:04:39.759674+03	2025-11-12 22:57:02.394028+03
204	40	\N	7	ለምናስተዳድራቸው ቤቶች የይዞታ ማረጋገጫ ካርታ እንዲኖራቸው ማድረግ	\N	To Do	\N	{"በቁጥር": "184"}	{"በቁጥር": "392"}	{}	{"q1": 80, "q2": 120, "q3": 120, "q4": 80}	0	0.5	f	2025-10-27 07:11:55.349347+03	2025-11-12 23:00:32.740988+03
211	11	\N	7	ለተጠሪ ተቋማት እና ለወረዳ ወቅታዊ የአቅም ግንባታ ድጋፍ መስጠት	\N	To Do	\N	{"በቁጥር": "2"}	{"በቁጥር": "2"}	{}	{"q2": 1, "q3": 1}	0	0.0999999998	f	2025-11-12 23:03:23.092067+03	2025-11-12 23:11:21.199801+03
\.


--
-- Data for Name: Attachments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Attachments" (id, "reportId", "publicId", "fileName", "filePath", "fileType", provider, "createdAt") FROM stdin;
1	1	\N	397324 (1) (1).jpg	1763235642635_397324__1___1_.jpg	image/jpeg	local	2025-11-15 22:40:44.366922+03
\.


--
-- Data for Name: AuditLogs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."AuditLogs" (id, "userId", action, entity, "entityId", details, ip, "userAgent", before, after, "createdAt") FROM stdin;
1	1	USER_LOGIN_SUCCESS	Auth	\N	{"username": "admin"}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	\N	\N	2025-11-11 15:05:41.637241+03
2	1	ACTIVITY_UPDATED	Activity	5	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 5, "title": "ወቅቱንና ጥራቱን የጠበቀ ዕቅድ ማዘጋጅት", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 6, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:01:57.796Z", "updatedAt": "2025-10-12T21:13:22.975Z", "description": null, "targetMetric": {"በቁጥር": "5"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 5, "title": "ወቅቱንና ጥራቱን የጠበቀ ዕቅድ ማዘጋጅት", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 6, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:01:57.796Z", "updatedAt": "2025-11-11T12:12:19.381Z", "description": null, "targetMetric": {"በቁጥር": "5"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "3"}, "quarterlyGoals": {"q1": 2, "q2": 1, "q3": 2}}	2025-11-11 15:12:19.381208+03
3	1	ACTIVITY_UPDATED	Activity	6	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 6, "title": "ወቅቱንና ጥራቱን የጠበቀ ሪፖርት ማዘጋጀት", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 6, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:11:01.479Z", "updatedAt": "2025-10-12T21:14:09.224Z", "description": "2 የተቀነሰው የሐምሌ እና ነሀሴ ካፒታል ፕሮጀክት ሪፖርት ስለሌለ ነው የ2017 ፊዚካል እና ፋይናንሺያል አፈጻጸማችንን ሰኔ ላይ አጠናቀን አስገብተናል ፋይናንሺያል ግሬስ ፔሬድ ላይ የነበረው በሰኔ ነው የሚያዘው 10 በየዉ ካፒታል ፕሮጀክት እና 4 መደበኛ ሪፖርት", "targetMetric": {"በሰነድ": "14"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 6, "title": "ወቅቱንና ጥራቱን የጠበቀ ሪፖርት ማዘጋጀት", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 6, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:11:01.479Z", "updatedAt": "2025-11-11T12:12:51.548Z", "description": "2 የተቀነሰው የሐምሌ እና ነሀሴ ካፒታል ፕሮጀክት ሪፖርት ስለሌለ ነው የ2017 ፊዚካል እና ፋይናንሺያል አፈጻጸማችንን ሰኔ ላይ አጠናቀን አስገብተናል ፋይናንሺያል ግሬስ ፔሬድ ላይ የነበረው በሰኔ ነው የሚያዘው 10 በየዉ ካፒታል ፕሮጀክት እና 4 መደበኛ ሪፖርት", "targetMetric": {"በሰነድ": "14"}, "currentMetric": {}, "previousMetric": {"በሰነድ": "10"}, "quarterlyGoals": {"q1": 2, "q2": 4, "q3": 4, "q4": 4}}	2025-11-11 15:12:51.548642+03
4	1	ACTIVITY_UPDATED	Activity	7	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 7, "title": "ወቅቱንና ጥራቱን የጠበቀ ግምገማ ማድረግ", "isDone": false, "rollNo": 3, "status": "To Do", "taskId": 6, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:15:22.612Z", "updatedAt": "2025-10-12T21:15:22.612Z", "description": null, "targetMetric": {"በሰነድ": "6"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 7, "title": "ወቅቱንና ጥራቱን የጠበቀ ግምገማ ማድረግ", "isDone": false, "rollNo": 3, "status": "To Do", "taskId": 6, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:15:22.612Z", "updatedAt": "2025-11-11T12:13:29.614Z", "description": null, "targetMetric": {"በሰነድ": "6"}, "currentMetric": {}, "previousMetric": {"በሰነድ": "6"}, "quarterlyGoals": {"q1": 1, "q2": 2, "q3": 1, "q4": 2}}	2025-11-11 15:13:29.614794+03
5	1	ACTIVITY_UPDATED	Activity	8	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 8, "title": "የዘርፉን መረጃ አያያዝ በቴክኖሎጂ በመደገፍ ማደራጀት", "isDone": false, "rollNo": 4, "status": "To Do", "taskId": 6, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:21:40.706Z", "updatedAt": "2025-10-12T21:21:40.706Z", "description": null, "targetMetric": {"በመቶኛ": "100"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 8, "title": "የዘርፉን መረጃ አያያዝ በቴክኖሎጂ በመደገፍ ማደራጀት", "isDone": false, "rollNo": 4, "status": "To Do", "taskId": 6, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:21:40.706Z", "updatedAt": "2025-11-11T12:15:13.009Z", "description": null, "targetMetric": {"በመቶኛ": "100"}, "currentMetric": {}, "previousMetric": {"በመቶኛ": "100"}, "quarterlyGoals": {"q1": 100, "q2": 100, "q3": 100, "q4": 100}}	2025-11-11 15:15:13.009333+03
6	1	ACTIVITY_UPDATED	Activity	9	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 9, "title": "ግልጽነት የሰፈነበት የሰው ኃይል ስምሪት ማካሄድ", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 7, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:23:46.356Z", "updatedAt": "2025-10-12T21:23:46.356Z", "description": null, "targetMetric": {"በመቶኛ": "100"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 9, "title": "ግልጽነት የሰፈነበት የሰው ኃይል ስምሪት ማካሄድ", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 7, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:23:46.356Z", "updatedAt": "2025-11-11T12:15:41.021Z", "description": null, "targetMetric": {"በመቶኛ": "100"}, "currentMetric": {}, "previousMetric": {"በመቶኛ": "100"}, "quarterlyGoals": {"q1": 100, "q2": 100, "q3": 100, "q4": 100}}	2025-11-11 15:15:41.021989+03
7	1	ACTIVITY_UPDATED	Activity	10	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 10, "title": "ለአመራር እና ለሰራተኞች የሚሰጡ ሥልጠናዎችን ማሳደግ", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 7, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:24:53.479Z", "updatedAt": "2025-10-12T21:24:53.479Z", "description": null, "targetMetric": {"በቁጥር": "200"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 10, "title": "ለአመራር እና ለሰራተኞች የሚሰጡ ሥልጠናዎችን ማሳደግ", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 7, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:24:53.479Z", "updatedAt": "2025-11-11T12:16:29.322Z", "description": null, "targetMetric": {"በቁጥር": "200"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "60"}, "quarterlyGoals": {"q2": 150, "q4": 50}}	2025-11-11 15:16:29.322911+03
8	1	ACTIVITY_UPDATED	Activity	11	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 11, "title": "የውስጥ የማበረታቻ ስርዓት መዘርጋት", "isDone": false, "rollNo": 3, "status": "To Do", "taskId": 7, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:25:25.932Z", "updatedAt": "2025-10-12T21:25:25.932Z", "description": null, "targetMetric": {"በጊዜ": "1"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 11, "title": "የውስጥ የማበረታቻ ስርዓት መዘርጋት", "isDone": false, "rollNo": 3, "status": "To Do", "taskId": 7, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:25:25.932Z", "updatedAt": "2025-11-11T12:16:49.458Z", "description": null, "targetMetric": {"በጊዜ": "1"}, "currentMetric": {}, "previousMetric": {"በጊዜ": "1"}, "quarterlyGoals": {"q4": 1}}	2025-11-11 15:16:49.458034+03
9	1	ACTIVITY_UPDATED	Activity	12	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 12, "title": "የሰራተኛ ዕርካታን ማሳደግ", "isDone": false, "rollNo": 4, "status": "To Do", "taskId": 7, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:26:14.654Z", "updatedAt": "2025-10-12T21:26:14.654Z", "description": null, "targetMetric": {"በመቶኛ": "60"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 12, "title": "የሰራተኛ ዕርካታን ማሳደግ", "isDone": false, "rollNo": 4, "status": "To Do", "taskId": 7, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:26:14.654Z", "updatedAt": "2025-11-11T12:24:48.546Z", "description": null, "targetMetric": {"በመቶኛ": "60"}, "currentMetric": {}, "previousMetric": {"በመቶኛ": "53.5"}, "quarterlyGoals": {}}	2025-11-11 15:24:48.546755+03
10	1	ACTIVITY_UPDATED	Activity	12	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 12, "title": "የሰራተኛ ዕርካታን ማሳደግ", "isDone": false, "rollNo": 4, "status": "To Do", "taskId": 7, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:26:14.654Z", "updatedAt": "2025-11-11T12:24:48.546Z", "description": null, "targetMetric": {"በመቶኛ": "60"}, "currentMetric": {}, "previousMetric": {"በመቶኛ": "53.5"}, "quarterlyGoals": {}}	{"id": 12, "title": "የሰራተኛ ዕርካታን ማሳደግ", "isDone": false, "rollNo": 4, "status": "To Do", "taskId": 7, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:26:14.654Z", "updatedAt": "2025-11-11T12:25:47.620Z", "description": null, "targetMetric": {"በመቶኛ": "60"}, "currentMetric": {}, "previousMetric": {"በመቶኛ": "53.5000"}, "quarterlyGoals": {"q3": 60}}	2025-11-11 15:25:47.620802+03
11	1	ACTIVITY_UPDATED	Activity	12	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 12, "title": "የሰራተኛ ዕርካታን ማሳደግ", "isDone": false, "rollNo": 4, "status": "To Do", "taskId": 7, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:26:14.654Z", "updatedAt": "2025-11-11T12:25:47.620Z", "description": null, "targetMetric": {"በመቶኛ": "60"}, "currentMetric": {}, "previousMetric": {"በመቶኛ": "53.5000"}, "quarterlyGoals": {"q3": 60}}	{"id": 12, "title": "የሰራተኛ ዕርካታን ማሳደግ", "isDone": false, "rollNo": 4, "status": "To Do", "taskId": 7, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:26:14.654Z", "updatedAt": "2025-11-11T12:26:03.029Z", "description": null, "targetMetric": {"በመቶኛ": "60"}, "currentMetric": {}, "previousMetric": {"በመቶኛ": "53.500000000000000000000"}, "quarterlyGoals": {"q3": 60}}	2025-11-11 15:26:03.029109+03
12	1	ACTIVITY_UPDATED	Activity	12	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 12, "title": "የሰራተኛ ዕርካታን ማሳደግ", "isDone": false, "rollNo": 4, "status": "To Do", "taskId": 7, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:26:14.654Z", "updatedAt": "2025-11-11T12:26:03.029Z", "description": null, "targetMetric": {"በመቶኛ": "60"}, "currentMetric": {}, "previousMetric": {"በመቶኛ": "53.500000000000000000000"}, "quarterlyGoals": {"q3": 60}}	{"id": 12, "title": "የሰራተኛ ዕርካታን ማሳደግ", "isDone": false, "rollNo": 4, "status": "To Do", "taskId": 7, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:26:14.654Z", "updatedAt": "2025-11-11T12:26:19.580Z", "description": null, "targetMetric": {"በመቶኛ": "60"}, "currentMetric": {}, "previousMetric": {"በመቶኛ": "53.37"}, "quarterlyGoals": {"q3": 60}}	2025-11-11 15:26:19.580749+03
13	1	ACTIVITY_UPDATED	Activity	12	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 12, "title": "የሰራተኛ ዕርካታን ማሳደግ", "isDone": false, "rollNo": 4, "status": "To Do", "taskId": 7, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:26:14.654Z", "updatedAt": "2025-11-11T12:26:19.580Z", "description": null, "targetMetric": {"በመቶኛ": "60"}, "currentMetric": {}, "previousMetric": {"በመቶኛ": "53.37"}, "quarterlyGoals": {"q3": 60}}	{"id": 12, "title": "የሰራተኛ ዕርካታን ማሳደግ", "isDone": false, "rollNo": 4, "status": "To Do", "taskId": 7, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:26:14.654Z", "updatedAt": "2025-11-11T12:26:29.870Z", "description": null, "targetMetric": {"በመቶኛ": "60"}, "currentMetric": {}, "previousMetric": {"በመቶኛ": "53.5"}, "quarterlyGoals": {"q3": 60}}	2025-11-11 15:26:29.870993+03
14	1	ACTIVITY_UPDATED	Activity	13	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 13, "title": "የሰራተኛ ፍልሰትን መቀነስ", "isDone": false, "rollNo": 5, "status": "To Do", "taskId": 7, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:26:59.304Z", "updatedAt": "2025-10-12T21:26:59.304Z", "description": null, "targetMetric": {"በመቶኛ": "0"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 13, "title": "የሰራተኛ ፍልሰትን መቀነስ", "isDone": false, "rollNo": 5, "status": "To Do", "taskId": 7, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:26:59.304Z", "updatedAt": "2025-11-11T12:27:50.514Z", "description": null, "targetMetric": {"በመቶኛ": "0"}, "currentMetric": {}, "previousMetric": {"በመቶኛ": "0.0037"}, "quarterlyGoals": {"q1": 0, "q2": 0, "q3": 0, "q4": 0}}	2025-11-11 15:27:50.514102+03
15	1	ACTIVITY_UPDATED	Activity	14	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 14, "title": "የተመደበ በጀት በአግባቡ ሥራ ላይ ማዋል", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 8, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:28:22.480Z", "updatedAt": "2025-10-12T21:28:22.480Z", "description": null, "targetMetric": {"በመቶኛ": "100"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 14, "title": "የተመደበ በጀት በአግባቡ ሥራ ላይ ማዋል", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 8, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:28:22.480Z", "updatedAt": "2025-11-11T12:28:53.928Z", "description": null, "targetMetric": {"በመቶኛ": "100"}, "currentMetric": {}, "previousMetric": {"በመቶኛ": "100"}, "quarterlyGoals": {"q1": 100, "q2": 100, "q3": 100, "q4": 100}}	2025-11-11 15:28:53.92843+03
16	1	ACTIVITY_UPDATED	Activity	14	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 14, "title": "የተመደበ በጀት በአግባቡ ሥራ ላይ ማዋል", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 8, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:28:22.480Z", "updatedAt": "2025-11-11T12:28:53.928Z", "description": null, "targetMetric": {"በመቶኛ": "100"}, "currentMetric": {}, "previousMetric": {"በመቶኛ": "100"}, "quarterlyGoals": {"q1": 100, "q2": 100, "q3": 100, "q4": 100}}	{"id": 14, "title": "የተመደበ በጀት በአግባቡ ሥራ ላይ ማዋል", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 8, "weight": "0.1", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:28:22.480Z", "updatedAt": "2025-11-11T12:32:22.318Z", "description": null, "targetMetric": {"በመቶኛ": "100"}, "currentMetric": {}, "previousMetric": {"በመቶኛ": "100"}, "quarterlyGoals": {"q1": 100, "q2": 100, "q3": 100, "q4": 100}}	2025-11-11 15:32:22.318991+03
17	1	ACTIVITY_UPDATED	Activity	15	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 15, "title": "ወቅቱን እና ጥራቱን የጠበቀ የሂሳብ ሪፖርት", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 8, "weight": "0.06", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:29:07.564Z", "updatedAt": "2025-10-12T21:29:07.564Z", "description": null, "targetMetric": {"በሰነድ": "12"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 15, "title": "ወቅቱን እና ጥራቱን የጠበቀ የሂሳብ ሪፖርት", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 8, "weight": "0.06", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:29:07.564Z", "updatedAt": "2025-11-11T12:32:46.842Z", "description": null, "targetMetric": {"በሰነድ": "12"}, "currentMetric": {}, "previousMetric": {"በሰነድ": "12"}, "quarterlyGoals": {"q1": 3, "q2": 3, "q3": 3, "q4": 3}}	2025-11-11 15:32:46.842948+03
18	1	ACTIVITY_UPDATED	Activity	14	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 14, "title": "የተመደበ በጀት በአግባቡ ሥራ ላይ ማዋል", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 8, "weight": "0.1", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:28:22.480Z", "updatedAt": "2025-11-11T12:32:22.318Z", "description": null, "targetMetric": {"በመቶኛ": "100"}, "currentMetric": {}, "previousMetric": {"በመቶኛ": "100"}, "quarterlyGoals": {"q1": 100, "q2": 100, "q3": 100, "q4": 100}}	{"id": 14, "title": "የተመደበ በጀት በአግባቡ ሥራ ላይ ማዋል", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 8, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:28:22.480Z", "updatedAt": "2025-11-11T12:33:01.560Z", "description": null, "targetMetric": {"በመቶኛ": "100"}, "currentMetric": {}, "previousMetric": {"በመቶኛ": "100"}, "quarterlyGoals": {"q1": 100, "q2": 100, "q3": 100, "q4": 100}}	2025-11-11 15:33:01.560383+03
19	1	ACTIVITY_UPDATED	Activity	14	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 14, "title": "የተመደበ በጀት በአግባቡ ሥራ ላይ ማዋል", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 8, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:28:22.480Z", "updatedAt": "2025-11-11T12:33:01.560Z", "description": null, "targetMetric": {"በመቶኛ": "100"}, "currentMetric": {}, "previousMetric": {"በመቶኛ": "100"}, "quarterlyGoals": {"q1": 100, "q2": 100, "q3": 100, "q4": 100}}	{"id": 14, "title": "የተመደበ በጀት በአግባቡ ሥራ ላይ ማዋል", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 8, "weight": "0.1", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:28:22.480Z", "updatedAt": "2025-11-11T12:33:15.318Z", "description": null, "targetMetric": {"በመቶኛ": "100"}, "currentMetric": {}, "previousMetric": {"በመቶኛ": "100"}, "quarterlyGoals": {"q1": 100, "q2": 100, "q3": 100, "q4": 100}}	2025-11-11 15:33:15.318758+03
20	1	ACTIVITY_UPDATED	Activity	16	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 16, "title": "በIBEX የተመዘገበ የበጀት ኮንትሮል ሪፖርት", "isDone": false, "rollNo": 3, "status": "To Do", "taskId": 8, "weight": "0.03", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:29:43.059Z", "updatedAt": "2025-10-12T21:29:43.059Z", "description": null, "targetMetric": {"በሰነድ": "1"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 16, "title": "በIBEX የተመዘገበ የበጀት ኮንትሮል ሪፖርት", "isDone": false, "rollNo": 3, "status": "To Do", "taskId": 8, "weight": "0.03", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:29:43.059Z", "updatedAt": "2025-11-11T12:33:40.193Z", "description": null, "targetMetric": {"በሰነድ": "1"}, "currentMetric": {}, "previousMetric": {"በሰነድ": "1"}, "quarterlyGoals": {"q4": 1}}	2025-11-11 15:33:40.193381+03
21	1	ACTIVITY_UPDATED	Activity	17	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 17, "title": "ተዘጋጅቶ የጸደቀ የተቋሙ የግዥ እቅድ", "isDone": false, "rollNo": 4, "status": "To Do", "taskId": 8, "weight": "0.04", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:30:17.083Z", "updatedAt": "2025-10-12T21:30:17.083Z", "description": null, "targetMetric": {"በሰነድ": "1"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 17, "title": "ተዘጋጅቶ የጸደቀ የተቋሙ የግዥ እቅድ", "isDone": false, "rollNo": 4, "status": "To Do", "taskId": 8, "weight": "0.04", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:30:17.083Z", "updatedAt": "2025-11-11T12:34:03.715Z", "description": null, "targetMetric": {"በሰነድ": "1"}, "currentMetric": {}, "previousMetric": {"በሰነድ": "1"}, "quarterlyGoals": {"q1": 1}}	2025-11-11 15:34:03.715562+03
22	1	ACTIVITY_UPDATED	Activity	18	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 18, "title": "በግዢ እቅዱ መሰረት የተዘጋጀ ሪፖርት", "isDone": false, "rollNo": 5, "status": "To Do", "taskId": 8, "weight": "0.04", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:31:10.749Z", "updatedAt": "2025-10-12T21:33:06.385Z", "description": null, "targetMetric": {"በሰነድ": "2"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 18, "title": "በግዢ እቅዱ መሰረት የተዘጋጀ ሪፖርት", "isDone": false, "rollNo": 5, "status": "To Do", "taskId": 8, "weight": "0.04", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:31:10.749Z", "updatedAt": "2025-11-11T12:34:52.986Z", "description": null, "targetMetric": {"በሰነድ": "2"}, "currentMetric": {}, "previousMetric": {"በሰነድ": "2"}, "quarterlyGoals": {"q2": 1, "q4": 1}}	2025-11-11 15:34:52.986825+03
23	1	ACTIVITY_UPDATED	Activity	19	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 19, "title": "የተፈጸመ የግልጽ ጨረታ ግዢ ድርሻ", "isDone": false, "rollNo": 6, "status": "To Do", "taskId": 8, "weight": "0.04", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:32:02.835Z", "updatedAt": "2025-10-12T21:32:02.835Z", "description": null, "targetMetric": {"በመቶኛ": "87"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 19, "title": "የተፈጸመ የግልጽ ጨረታ ግዢ ድርሻ", "isDone": false, "rollNo": 6, "status": "To Do", "taskId": 8, "weight": "0.04", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:32:02.835Z", "updatedAt": "2025-11-11T12:35:23.507Z", "description": null, "targetMetric": {"በመቶኛ": "87"}, "currentMetric": {}, "previousMetric": {"በመቶኛ": "85"}, "quarterlyGoals": {"q4": 87}}	2025-11-11 15:35:23.507481+03
24	1	ACTIVITY_UPDATED	Activity	20	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 20, "title": "ወቅቱን እና ጥራቱን የጠበቀ የኦዲት ሪፖርት", "isDone": false, "rollNo": 7, "status": "To Do", "taskId": 8, "weight": "0.04", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:34:34.580Z", "updatedAt": "2025-10-12T21:34:34.580Z", "description": null, "targetMetric": {"በሰነድ": "4"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 20, "title": "ወቅቱን እና ጥራቱን የጠበቀ የኦዲት ሪፖርት", "isDone": false, "rollNo": 7, "status": "To Do", "taskId": 8, "weight": "0.04", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:34:34.580Z", "updatedAt": "2025-11-11T12:36:01.480Z", "description": null, "targetMetric": {"በሰነድ": "4"}, "currentMetric": {}, "previousMetric": {"በሰነድ": "4"}, "quarterlyGoals": {"q1": 1, "q2": 1, "q3": 1, "q4": 1}}	2025-11-11 15:36:01.480599+03
25	1	ACTIVITY_UPDATED	Activity	21	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 21, "title": "ነቀፌታ ያለበትን የኦዲት ግኝት መቀነስ", "isDone": false, "rollNo": 8, "status": "To Do", "taskId": 8, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:35:16.843Z", "updatedAt": "2025-10-12T21:35:16.843Z", "description": null, "targetMetric": {"በቁጥር": "0"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 21, "title": "ነቀፌታ ያለበትን የኦዲት ግኝት መቀነስ", "isDone": false, "rollNo": 8, "status": "To Do", "taskId": 8, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:35:16.843Z", "updatedAt": "2025-11-11T12:36:38.511Z", "description": null, "targetMetric": {"በቁጥር": "0"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "0"}, "quarterlyGoals": {"q4": 0}}	2025-11-11 15:36:38.511393+03
26	1	ACTIVITY_UPDATED	Activity	23	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 23, "title": "አጠቃላይ ቆጠራ ተደርጎ፣ ዋጋ ተሰጥቶት፣ ተመዝግቦ መለያ ምልክት የተለጠፈበት ቋሚ ንብረት", "isDone": false, "rollNo": 10, "status": "To Do", "taskId": 8, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:36:48.014Z", "updatedAt": "2025-10-12T21:36:48.014Z", "description": null, "targetMetric": {"በመቶኛ": "100"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 23, "title": "አጠቃላይ ቆጠራ ተደርጎ፣ ዋጋ ተሰጥቶት፣ ተመዝግቦ መለያ ምልክት የተለጠፈበት ቋሚ ንብረት", "isDone": false, "rollNo": 10, "status": "To Do", "taskId": 8, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:36:48.014Z", "updatedAt": "2025-11-11T12:37:34.856Z", "description": null, "targetMetric": {"በመቶኛ": "100"}, "currentMetric": {}, "previousMetric": {"በመቶኛ": "100"}, "quarterlyGoals": {"q4": 100}}	2025-11-11 15:37:34.856384+03
27	1	ACTIVITY_UPDATED	Activity	24	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 24, "title": "አመታዊ የቋሚ ንብረት መግለጫ (አስ) ማዘጋጀት", "isDone": false, "rollNo": 11, "status": "To Do", "taskId": 8, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:37:44.654Z", "updatedAt": "2025-10-12T21:37:44.654Z", "description": null, "targetMetric": {"በሰነድ": "1"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 24, "title": "አመታዊ የቋሚ ንብረት መግለጫ (አስ) ማዘጋጀት", "isDone": false, "rollNo": 11, "status": "To Do", "taskId": 8, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:37:44.654Z", "updatedAt": "2025-11-11T12:38:16.307Z", "description": null, "targetMetric": {"በሰነድ": "1"}, "currentMetric": {}, "previousMetric": {"በሰነድ": "3"}, "quarterlyGoals": {"q1": 1}}	2025-11-11 15:38:16.307956+03
28	1	ACTIVITY_UPDATED	Activity	25	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 25, "title": "የቋሚ ንብረት ጥገናና ዕድሳት ስኬጁል ማዘጋጀት", "isDone": false, "rollNo": 12, "status": "To Do", "taskId": 8, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:38:30.053Z", "updatedAt": "2025-10-12T21:38:30.053Z", "description": null, "targetMetric": {"በሰነድ": "1"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 25, "title": "የቋሚ ንብረት ጥገናና ዕድሳት ስኬጁል ማዘጋጀት", "isDone": false, "rollNo": 12, "status": "To Do", "taskId": 8, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:38:30.053Z", "updatedAt": "2025-11-11T12:38:39.477Z", "description": null, "targetMetric": {"በሰነድ": "1"}, "currentMetric": {}, "previousMetric": {"በሰነድ": "3"}, "quarterlyGoals": {"q1": 1}}	2025-11-11 15:38:39.477442+03
29	1	ACTIVITY_UPDATED	Activity	24	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 24, "title": "አመታዊ የቋሚ ንብረት መግለጫ (አስ) ማዘጋጀት", "isDone": false, "rollNo": 11, "status": "To Do", "taskId": 8, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:37:44.654Z", "updatedAt": "2025-11-11T12:38:16.307Z", "description": null, "targetMetric": {"በሰነድ": "1"}, "currentMetric": {}, "previousMetric": {"በሰነድ": "3"}, "quarterlyGoals": {"q1": 1}}	{"id": 24, "title": "አመታዊ የቋሚ ንብረት መግለጫ (አስ) ማዘጋጀት", "isDone": false, "rollNo": 11, "status": "To Do", "taskId": 8, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:37:44.654Z", "updatedAt": "2025-11-11T12:38:50.277Z", "description": null, "targetMetric": {"በሰነድ": "1"}, "currentMetric": {}, "previousMetric": {"በሰነድ": "1"}, "quarterlyGoals": {"q1": 1}}	2025-11-11 15:38:50.277004+03
30	1	ACTIVITY_UPDATED	Activity	26	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 26, "title": "በፕሮግራሙ መሰረት ጥገና የተደረገላቸዉ ቋሚ ንብረቶች", "isDone": false, "rollNo": 13, "status": "To Do", "taskId": 8, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:38:53.371Z", "updatedAt": "2025-10-12T21:38:53.371Z", "description": null, "targetMetric": {"በቁጥር": "10"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 26, "title": "በፕሮግራሙ መሰረት ጥገና የተደረገላቸዉ ቋሚ ንብረቶች", "isDone": false, "rollNo": 13, "status": "To Do", "taskId": 8, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:38:53.371Z", "updatedAt": "2025-11-11T12:39:20.457Z", "description": null, "targetMetric": {"በቁጥር": "10"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "3"}, "quarterlyGoals": {"q3": 5, "q4": 5}}	2025-11-11 15:39:20.457258+03
31	1	ACTIVITY_UPDATED	Activity	14	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 14, "title": "የተመደበ በጀት በአግባቡ ሥራ ላይ ማዋል", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 8, "weight": "0.1", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:28:22.480Z", "updatedAt": "2025-11-11T12:33:15.318Z", "description": null, "targetMetric": {"በመቶኛ": "100"}, "currentMetric": {}, "previousMetric": {"በመቶኛ": "100"}, "quarterlyGoals": {"q1": 100, "q2": 100, "q3": 100, "q4": 100}}	{"id": 14, "title": "የተመደበ በጀት በአግባቡ ሥራ ላይ ማዋል", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 8, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:28:22.480Z", "updatedAt": "2025-11-11T12:39:46.862Z", "description": null, "targetMetric": {"በመቶኛ": "100"}, "currentMetric": {}, "previousMetric": {"በመቶኛ": "100"}, "quarterlyGoals": {"q1": 100, "q2": 100, "q3": 100, "q4": 100}}	2025-11-11 15:39:46.862191+03
32	1	ACTIVITY_UPDATED	Activity	27	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 27, "title": "መረጃ ቋት ማደራጀት", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 9, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:39:56.873Z", "updatedAt": "2025-10-12T21:39:56.873Z", "description": null, "targetMetric": {"በመቶኛ": "100"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 27, "title": "መረጃ ቋት ማደራጀት", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 9, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:39:56.873Z", "updatedAt": "2025-11-11T12:41:41.225Z", "description": null, "targetMetric": {"በመቶኛ": "100"}, "currentMetric": {}, "previousMetric": {"በመቶኛ": "97"}, "quarterlyGoals": {"q2": 98, "q4": 100}}	2025-11-11 15:41:41.22569+03
33	1	ACTIVITY_UPDATED	Activity	28	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 28, "title": "በተቋሙ ወረቀት አልባ አሰራርን መተግበር", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 9, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:40:24.524Z", "updatedAt": "2025-10-12T21:40:24.524Z", "description": null, "targetMetric": {"በመቶኛ": "80"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 28, "title": "በተቋሙ ወረቀት አልባ አሰራርን መተግበር", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 9, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:40:24.524Z", "updatedAt": "2025-11-11T12:42:09.381Z", "description": null, "targetMetric": {"በመቶኛ": "80"}, "currentMetric": {}, "previousMetric": {"በመቶኛ": "60"}, "quarterlyGoals": {"q1": 65, "q2": 70, "q3": 75, "q4": 80}}	2025-11-11 15:42:09.381817+03
34	1	ACTIVITY_UPDATED	Activity	29	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 29, "title": "በተቋሙ የሚሰጠ አገልግሎቶችን ኦቶሜት ማድረግ", "isDone": false, "rollNo": 3, "status": "To Do", "taskId": 9, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:40:53.620Z", "updatedAt": "2025-10-12T21:40:53.620Z", "description": null, "targetMetric": {"በመቶኛ": "80"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 29, "title": "በተቋሙ የሚሰጠ አገልግሎቶችን ኦቶሜት ማድረግ", "isDone": false, "rollNo": 3, "status": "To Do", "taskId": 9, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:40:53.620Z", "updatedAt": "2025-11-11T12:42:43.269Z", "description": null, "targetMetric": {"በመቶኛ": "80"}, "currentMetric": {}, "previousMetric": {"በመቶኛ": "55"}, "quarterlyGoals": {"q1": 60, "q2": 65, "q3": 75, "q4": 80}}	2025-11-11 15:42:43.269736+03
35	1	ACTIVITY_UPDATED	Activity	30	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 30, "title": "የተሻሻለና ደህንነቱ የተረጋገጠ የኢኮቴ አጠቃቀም", "isDone": false, "rollNo": 4, "status": "To Do", "taskId": 9, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:41:19.299Z", "updatedAt": "2025-10-12T21:41:19.299Z", "description": null, "targetMetric": {"በመቶኛ": "100"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 30, "title": "የተሻሻለና ደህንነቱ የተረጋገጠ የኢኮቴ አጠቃቀም", "isDone": false, "rollNo": 4, "status": "To Do", "taskId": 9, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:41:19.299Z", "updatedAt": "2025-11-11T12:43:13.864Z", "description": null, "targetMetric": {"በመቶኛ": "100"}, "currentMetric": {}, "previousMetric": {"በመቶኛ": "75"}, "quarterlyGoals": {"q1": 80, "q3": 90, "q4": 100}}	2025-11-11 15:43:13.864977+03
36	1	ACTIVITY_UPDATED	Activity	31	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 31, "title": "ለተቋም አቅም ግንባታ በክልል ውስጥ አጋርነት የተገኘ ድጋፍ", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 10, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:42:45.939Z", "updatedAt": "2025-10-12T21:42:45.939Z", "description": null, "targetMetric": {"በብር": "1,000,000"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 31, "title": "ለተቋም አቅም ግንባታ በክልል ውስጥ አጋርነት የተገኘ ድጋፍ", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 10, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:42:45.939Z", "updatedAt": "2025-11-11T12:44:13.498Z", "description": null, "targetMetric": {"በብር": "1000000"}, "currentMetric": {}, "previousMetric": {"በብር": "45000"}, "quarterlyGoals": {"q3": 1000000}}	2025-11-11 15:44:13.498104+03
37	1	ACTIVITY_UPDATED	Activity	32	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 32, "title": "ለተቋም አቅም ግንባታ በሀገር ዉስጥ አጋርነት የተገኘ ድጋፍ ለመሰብሰብ፤", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 10, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:43:18.082Z", "updatedAt": "2025-10-12T21:43:18.082Z", "description": null, "targetMetric": {"በብር": "100,000"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 32, "title": "ለተቋም አቅም ግንባታ በሀገር ዉስጥ አጋርነት የተገኘ ድጋፍ ለመሰብሰብ፤", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 10, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:43:18.082Z", "updatedAt": "2025-11-11T12:44:46.201Z", "description": null, "targetMetric": {"በብር": "100000"}, "currentMetric": {}, "previousMetric": {"በብር": "50000"}, "quarterlyGoals": {"q4": 100000}}	2025-11-11 15:44:46.201625+03
38	1	ACTIVITY_UPDATED	Activity	33	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 33, "title": "መረጃዎችን በተለያዩ የተግባቦት ዘዴዎች ተደራሽ ማድረግ", "isDone": false, "rollNo": 3, "status": "To Do", "taskId": 10, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:43:47.064Z", "updatedAt": "2025-10-12T21:43:47.064Z", "description": null, "targetMetric": {"በመቶኛ": "100"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 33, "title": "መረጃዎችን በተለያዩ የተግባቦት ዘዴዎች ተደራሽ ማድረግ", "isDone": false, "rollNo": 3, "status": "To Do", "taskId": 10, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:43:47.064Z", "updatedAt": "2025-11-11T12:45:33.589Z", "description": null, "targetMetric": {"በመቶኛ": "100"}, "currentMetric": {}, "previousMetric": {"በመቶኛ": "100"}, "quarterlyGoals": {"q1": 100, "q2": 100, "q3": 100, "q4": 100}}	2025-11-11 15:45:33.589642+03
39	1	ACTIVITY_UPDATED	Activity	34	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 34, "title": "የተጠሪ ተቋማት ዕቅድን ከዘርፍ ዕቅድ ጋር ማናበብና ማጣጣም", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 11, "weight": "0.2", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:44:42.764Z", "updatedAt": "2025-10-12T21:44:42.764Z", "description": null, "targetMetric": {"በሰነድ": "6"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 34, "title": "የተጠሪ ተቋማት ዕቅድን ከዘርፍ ዕቅድ ጋር ማናበብና ማጣጣም", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 11, "weight": "0.2", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:44:42.764Z", "updatedAt": "2025-11-11T12:46:10.753Z", "description": null, "targetMetric": {"በሰነድ": "6"}, "currentMetric": {}, "previousMetric": {"በሰነድ": "6"}, "quarterlyGoals": {"q1": 6}}	2025-11-11 15:46:10.753371+03
40	1	ACTIVITY_UPDATED	Activity	35	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 35, "title": "የየሩብ ዓመት የተጠሪ ተቋማት ሪፖርት መገምገም", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 11, "weight": "0.2", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:45:09.364Z", "updatedAt": "2025-10-12T21:46:21.495Z", "description": null, "targetMetric": {"በቁጥር": "4"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 35, "title": "የየሩብ ዓመት የተጠሪ ተቋማት ሪፖርት መገምገም", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 11, "weight": "0.2", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:45:09.364Z", "updatedAt": "2025-11-11T12:48:00.018Z", "description": null, "targetMetric": {"በቁጥር": "4"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "3"}, "quarterlyGoals": {"q1": 1, "q2": 1, "q3": 1, "q4": 1}}	2025-11-11 15:48:00.018251+03
41	1	ACTIVITY_UPDATED	Activity	36	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 36, "title": "የቢሮዉን/ተቋሙን ዕቅድ ከክልሉ ዕቅድ ጋር ማናበብና ማጣጣም", "isDone": false, "rollNo": 3, "status": "To Do", "taskId": 11, "weight": "0.2", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:45:37.160Z", "updatedAt": "2025-10-12T21:45:37.160Z", "description": null, "targetMetric": {"በሰነድ": "1"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 36, "title": "የቢሮዉን/ተቋሙን ዕቅድ ከክልሉ ዕቅድ ጋር ማናበብና ማጣጣም", "isDone": false, "rollNo": 3, "status": "To Do", "taskId": 11, "weight": "0.2", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:45:37.160Z", "updatedAt": "2025-11-11T12:48:34.581Z", "description": null, "targetMetric": {"በሰነድ": "1"}, "currentMetric": {}, "previousMetric": {"በሰነድ": "1"}, "quarterlyGoals": {"q1": 2}}	2025-11-11 15:48:34.581453+03
42	1	ACTIVITY_UPDATED	Activity	37	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 37, "title": "የተቋሙን/የቢሮዉን ዕቅድ ለወረዳ ማዉረድ", "isDone": false, "rollNo": 4, "status": "To Do", "taskId": 11, "weight": "0.2", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:46:50.195Z", "updatedAt": "2025-10-12T21:46:50.195Z", "description": null, "targetMetric": {"በሰነድ": "9"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 37, "title": "የተቋሙን/የቢሮዉን ዕቅድ ለወረዳ ማዉረድ", "isDone": false, "rollNo": 4, "status": "To Do", "taskId": 11, "weight": "0.2", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:46:50.195Z", "updatedAt": "2025-11-11T12:49:12.803Z", "description": null, "targetMetric": {"በሰነድ": "9"}, "currentMetric": {}, "previousMetric": {"በሰነድ": "9"}, "quarterlyGoals": {"q1": 9}}	2025-11-11 15:49:12.803451+03
43	1	ACTIVITY_UPDATED	Activity	38	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 38, "title": "የተቋሙን/የቢሮዉን እና የወረዳን አፈጻጸም በየሩብ ዓመቱ በጋራ መገምገም", "isDone": false, "rollNo": 5, "status": "To Do", "taskId": 11, "weight": "0.1", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:47:19.684Z", "updatedAt": "2025-10-12T21:47:19.684Z", "description": null, "targetMetric": {"በቁጥር": "4"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 38, "title": "የተቋሙን/የቢሮዉን እና የወረዳን አፈጻጸም በየሩብ ዓመቱ በጋራ መገምገም", "isDone": false, "rollNo": 5, "status": "To Do", "taskId": 11, "weight": "0.1", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:47:19.684Z", "updatedAt": "2025-11-11T12:49:44.377Z", "description": null, "targetMetric": {"በቁጥር": "4"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "3"}, "quarterlyGoals": {"q1": 1, "q2": 1, "q3": 1, "q4": 1}}	2025-11-11 15:49:44.377757+03
44	1	ACTIVITY_UPDATED	Activity	39	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 39, "title": "በብልሹ አሰራር ዙርያ ጥቆማ ከተደረገባቸው ውስጥ ማስተካከያ የተደረገባቸው", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 12, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:49:40.867Z", "updatedAt": "2025-10-12T21:49:40.867Z", "description": null, "targetMetric": {"በመቶኛ": "100"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 39, "title": "በብልሹ አሰራር ዙርያ ጥቆማ ከተደረገባቸው ውስጥ ማስተካከያ የተደረገባቸው", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 12, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:49:40.867Z", "updatedAt": "2025-11-11T12:50:57.564Z", "description": null, "targetMetric": {"በመቶኛ": "100"}, "currentMetric": {}, "previousMetric": {"በመቶኛ": "100"}, "quarterlyGoals": {"q1": 100, "q2": 100, "q3": 100, "q4": 100}}	2025-11-11 15:50:57.564987+03
45	1	ACTIVITY_UPDATED	Activity	40	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 40, "title": "ለብልሹ አሰራር የተጋለጡ አሰራሮች በጥናት በመለየት የማሻሻያ ሀሳብ ማቅረብ", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 12, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:50:05.906Z", "updatedAt": "2025-10-12T21:50:05.906Z", "description": null, "targetMetric": {"በቁጥር": "1"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 40, "title": "ለብልሹ አሰራር የተጋለጡ አሰራሮች በጥናት በመለየት የማሻሻያ ሀሳብ ማቅረብ", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 12, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:50:05.906Z", "updatedAt": "2025-11-11T12:51:23.019Z", "description": null, "targetMetric": {"በቁጥር": "1"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "2"}, "quarterlyGoals": {"q3": 1}}	2025-11-11 15:51:23.019773+03
46	1	ACTIVITY_UPDATED	Activity	41	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 41, "title": "በቴክኖሎጂ የተደገፈ መሰረታዊ አገልግሎትን በቅልጥፍና በመስጠት የደንበኞችን እርካታ ማሻሻል", "isDone": false, "rollNo": 3, "status": "To Do", "taskId": 12, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:53:31.031Z", "updatedAt": "2025-10-12T21:54:03.554Z", "description": null, "targetMetric": {"በመቶኛ": "75"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 41, "title": "በቴክኖሎጂ የተደገፈ መሰረታዊ አገልግሎትን በቅልጥፍና በመስጠት የደንበኞችን እርካታ ማሻሻል", "isDone": false, "rollNo": 3, "status": "To Do", "taskId": 12, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:53:31.031Z", "updatedAt": "2025-11-11T12:51:42.730Z", "description": null, "targetMetric": {"በመቶኛ": "75"}, "currentMetric": {}, "previousMetric": {"በመቶኛ": "65"}, "quarterlyGoals": {"q4": 75}}	2025-11-11 15:51:42.730087+03
47	1	ACTIVITY_UPDATED	Activity	42	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 42, "title": "የሀብት ምዝገባ ያካሄዱ አመራሮች እና ባለሞያዎች ድርሻ ማሳደግ", "isDone": false, "rollNo": 4, "status": "To Do", "taskId": 12, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:54:31.928Z", "updatedAt": "2025-10-12T21:54:31.928Z", "description": null, "targetMetric": {"በቁጥር": "100"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 42, "title": "የሀብት ምዝገባ ያካሄዱ አመራሮች እና ባለሞያዎች ድርሻ ማሳደግ", "isDone": false, "rollNo": 4, "status": "To Do", "taskId": 12, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:54:31.928Z", "updatedAt": "2025-11-11T12:52:14.052Z", "description": null, "targetMetric": {"በቁጥር": "100"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "37"}, "quarterlyGoals": {"q3": 100}}	2025-11-11 15:52:14.052802+03
48	1	ACTIVITY_UPDATED	Activity	43	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 43, "title": "የህጻናት ማቆያ አገልግሎት ተጠቃሚ ሰራተኞች ብዛት ማሳደግ", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 13, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:56:49.859Z", "updatedAt": "2025-10-12T21:56:49.859Z", "description": null, "targetMetric": {"በቁጥር": "10"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 43, "title": "የህጻናት ማቆያ አገልግሎት ተጠቃሚ ሰራተኞች ብዛት ማሳደግ", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 13, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:56:49.859Z", "updatedAt": "2025-11-11T12:53:05.238Z", "description": null, "targetMetric": {"በቁጥር": "10"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "9"}, "quarterlyGoals": {"q4": 10}}	2025-11-11 15:53:05.23862+03
49	1	ACTIVITY_UPDATED	Activity	44	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 44, "title": "ወደ አመራር የመጡ ሴት ሰራተኞች ብዛት ማሳደግ", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 13, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:57:17.692Z", "updatedAt": "2025-10-12T21:57:17.692Z", "description": null, "targetMetric": {"በመቶኛ": "50"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 44, "title": "ወደ አመራር የመጡ ሴት ሰራተኞች ብዛት ማሳደግ", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 13, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:57:17.692Z", "updatedAt": "2025-11-11T12:53:33.495Z", "description": null, "targetMetric": {"በመቶኛ": "50"}, "currentMetric": {}, "previousMetric": {"በመቶኛ": "27.5"}, "quarterlyGoals": {"q4": 50}}	2025-11-11 15:53:33.495864+03
50	1	ACTIVITY_UPDATED	Activity	45	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 45, "title": "ሥልጠና ያገኙ ሴት ሰራተኞች ድርሻ ማሳደግ", "isDone": false, "rollNo": 3, "status": "To Do", "taskId": 13, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:57:43.590Z", "updatedAt": "2025-10-12T21:57:43.590Z", "description": null, "targetMetric": {"በመቶኛ": "100"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 45, "title": "ሥልጠና ያገኙ ሴት ሰራተኞች ድርሻ ማሳደግ", "isDone": false, "rollNo": 3, "status": "To Do", "taskId": 13, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:57:43.590Z", "updatedAt": "2025-11-11T12:54:00.168Z", "description": null, "targetMetric": {"በመቶኛ": "100"}, "currentMetric": {}, "previousMetric": {"በመቶኛ": "80"}, "quarterlyGoals": {"q1": 85, "q2": 90, "q3": 95, "q4": 100}}	2025-11-11 15:54:00.168475+03
51	1	ACTIVITY_UPDATED	Activity	46	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 46, "title": "ለአካል ጉዳተኛ ሰራተኞችና ተገልጋዮች ምቹ የስራ ሁኔታና ቦታ መፍጠር", "isDone": false, "rollNo": 4, "status": "To Do", "taskId": 13, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:58:13.188Z", "updatedAt": "2025-10-12T21:58:13.188Z", "description": null, "targetMetric": {"በመቶኛ": "100"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 46, "title": "ለአካል ጉዳተኛ ሰራተኞችና ተገልጋዮች ምቹ የስራ ሁኔታና ቦታ መፍጠር", "isDone": false, "rollNo": 4, "status": "To Do", "taskId": 13, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:58:13.188Z", "updatedAt": "2025-11-11T12:54:22.750Z", "description": null, "targetMetric": {"በመቶኛ": "100"}, "currentMetric": {}, "previousMetric": {"በመቶኛ": "50"}, "quarterlyGoals": {"q1": 60, "q2": 65, "q3": 70, "q4": 100}}	2025-11-11 15:54:22.750709+03
52	1	ACTIVITY_UPDATED	Activity	47	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 47, "title": "የአረንጓዴ አሻራ ተግባራትን ማካሄድ የቀረበ ችግኝ", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 14, "weight": "0.2", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T02:44:09.471Z", "updatedAt": "2025-10-13T02:44:09.471Z", "description": null, "targetMetric": {"በቁጥር": "1602"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 47, "title": "የአረንጓዴ አሻራ ተግባራትን ማካሄድ የቀረበ ችግኝ", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 14, "weight": "0.2", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T02:44:09.471Z", "updatedAt": "2025-11-11T12:57:52.410Z", "description": null, "targetMetric": {"በቁጥር": "1602"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "2800"}, "quarterlyGoals": {"q1": 1602}}	2025-11-11 15:57:52.410459+03
53	1	ACTIVITY_UPDATED	Activity	48	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 48, "title": "የአረንጓዴ አሻራ ተግባራትን ማካሄድ የተተከለ ችግኝ", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 14, "weight": "0.15", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T02:44:39.657Z", "updatedAt": "2025-10-13T02:44:39.657Z", "description": null, "targetMetric": {"በቁጥር": "1602"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 48, "title": "የአረንጓዴ አሻራ ተግባራትን ማካሄድ የተተከለ ችግኝ", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 14, "weight": "0.15", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T02:44:39.657Z", "updatedAt": "2025-11-11T12:58:15.452Z", "description": null, "targetMetric": {"በቁጥር": "1602"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "2800"}, "quarterlyGoals": {"q1": 1602}}	2025-11-11 15:58:15.452451+03
54	1	ACTIVITY_UPDATED	Activity	49	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 49, "title": "የአረንጓዴ አሻራ ተግባራትን ክብካቤ የተደረገለት ችግኝ", "isDone": false, "rollNo": 3, "status": "To Do", "taskId": 14, "weight": "0.15", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T02:45:10.939Z", "updatedAt": "2025-10-13T02:45:10.939Z", "description": null, "targetMetric": {"በቁጥር": "1602"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 49, "title": "የአረንጓዴ አሻራ ተግባራትን ክብካቤ የተደረገለት ችግኝ", "isDone": false, "rollNo": 3, "status": "To Do", "taskId": 14, "weight": "0.15", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T02:45:10.939Z", "updatedAt": "2025-11-11T12:59:34.575Z", "description": null, "targetMetric": {"በቁጥር": "1602"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "1000"}, "quarterlyGoals": {"q1": 1602, "q2": 1522, "q3": 1446, "q4": 1361}}	2025-11-11 15:59:34.575254+03
55	1	ACTIVITY_UPDATED	Activity	50	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 50, "title": "የአረንጓዴ አሻራ ተግባራትን ማካሄድ የጸደቀ ችግኝ", "isDone": false, "rollNo": 4, "status": "To Do", "taskId": 14, "weight": "0.15", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T02:46:07.934Z", "updatedAt": "2025-10-13T02:50:46.408Z", "description": null, "targetMetric": {"በቁጥር": "1361"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 50, "title": "የአረንጓዴ አሻራ ተግባራትን ማካሄድ የጸደቀ ችግኝ", "isDone": false, "rollNo": 4, "status": "To Do", "taskId": 14, "weight": "0.15", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T02:46:07.934Z", "updatedAt": "2025-11-11T13:00:37.565Z", "description": null, "targetMetric": {"በቁጥር": "1361"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "1000"}, "quarterlyGoals": {"q1": 1361, "q4": 1361}}	2025-11-11 16:00:37.56561+03
56	1	ACTIVITY_UPDATED	Activity	51	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 51, "title": "የአቅመ ደካማ ማህበረሰቦች የመኖሪያ ቤቶች መገንባት (ማደስ) ብዛት", "isDone": false, "rollNo": 5, "status": "To Do", "taskId": 14, "weight": "0.15", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T02:46:39.000Z", "updatedAt": "2025-10-13T02:46:39.000Z", "description": null, "targetMetric": {"በቁጥር": "4"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 51, "title": "የአቅመ ደካማ ማህበረሰቦች የመኖሪያ ቤቶች መገንባት (ማደስ) ብዛት", "isDone": false, "rollNo": 5, "status": "To Do", "taskId": 14, "weight": "0.15", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T02:46:39.000Z", "updatedAt": "2025-11-11T13:01:05.760Z", "description": null, "targetMetric": {"በቁጥር": "4"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "4"}, "quarterlyGoals": {"q1": 2, "q4": 2}}	2025-11-11 16:01:05.760708+03
57	1	ACTIVITY_UPDATED	Activity	52	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 52, "title": "የአቅመ ደካማ ማህበረሰቦች የመኖሪያ ቤቶች መገንባት (ማደስ) በብር\\t0.15\\tበብር\\t3ሚ", "isDone": false, "rollNo": 6, "status": "To Do", "taskId": 14, "weight": "0.15", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T02:47:59.237Z", "updatedAt": "2025-10-13T02:47:59.237Z", "description": null, "targetMetric": {"በብር": "1.5ሚ"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 52, "title": "የአቅመ ደካማ ማህበረሰቦች የመኖሪያ ቤቶች መገንባት (ማደስ) በብር\\t0.15\\tበብር\\t3ሚ", "isDone": false, "rollNo": 6, "status": "To Do", "taskId": 14, "weight": "0.15", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T02:47:59.237Z", "updatedAt": "2025-11-11T13:03:44.246Z", "description": null, "targetMetric": {"በብር": "1500000"}, "currentMetric": {}, "previousMetric": {"በብር": "3000000"}, "quarterlyGoals": {"q1": 700000, "q4": 800000}}	2025-11-11 16:03:44.246408+03
58	1	ACTIVITY_UPDATED	Activity	53	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 53, "title": "የአቅመ ደካማ ቤተሰብ ተማሪዎች ድጋፍ በገንዘብ", "isDone": false, "rollNo": 7, "status": "To Do", "taskId": 14, "weight": "0.15", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T02:49:09.899Z", "updatedAt": "2025-10-13T02:49:09.899Z", "description": null, "targetMetric": {"በብር": "400ሺ"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 53, "title": "የአቅመ ደካማ ቤተሰብ ተማሪዎች ድጋፍ በገንዘብ", "isDone": false, "rollNo": 7, "status": "To Do", "taskId": 14, "weight": "0.15", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T02:49:09.899Z", "updatedAt": "2025-11-11T13:04:50.189Z", "description": null, "targetMetric": {"በብር": "400000"}, "currentMetric": {}, "previousMetric": {"በብር": "165000"}, "quarterlyGoals": {"q1": 100000, "q2": 100000, "q3": 100000, "q4": 100000}}	2025-11-11 16:04:50.189687+03
59	1	ACTIVITY_UPDATED	Activity	54	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 54, "title": "ለተለያዩ ማህበራዊ ቀውሶች የተደረገ ድጋፍ", "isDone": false, "rollNo": 8, "status": "To Do", "taskId": 14, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T02:50:21.673Z", "updatedAt": "2025-10-13T02:51:10.203Z", "description": null, "targetMetric": {"በብር": "400ሺ"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 54, "title": "ለተለያዩ ማህበራዊ ቀውሶች የተደረገ ድጋፍ", "isDone": false, "rollNo": 8, "status": "To Do", "taskId": 14, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T02:50:21.673Z", "updatedAt": "2025-11-11T13:06:25.462Z", "description": null, "targetMetric": {"በብር": "400000"}, "currentMetric": {}, "previousMetric": {"በብር": "200000"}, "quarterlyGoals": {"q1": 100000, "q2": 100000, "q3": 100000, "q4": 100000}}	2025-11-11 16:06:25.462816+03
60	1	ACTIVITY_UPDATED	Activity	55	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 55, "title": "የተደረገ ደም ልገሳ", "isDone": false, "rollNo": 9, "status": "To Do", "taskId": 14, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T02:51:55.892Z", "updatedAt": "2025-10-13T02:51:55.892Z", "description": null, "targetMetric": {"ዩኒት": "30"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 55, "title": "የተደረገ ደም ልገሳ", "isDone": false, "rollNo": 9, "status": "To Do", "taskId": 14, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T02:51:55.892Z", "updatedAt": "2025-11-11T13:07:05.950Z", "description": null, "targetMetric": {"ዩኒት": "30"}, "currentMetric": {}, "previousMetric": {"ዩኒት": "13"}, "quarterlyGoals": {"q2": 15, "q4": 15}}	2025-11-11 16:07:05.950057+03
61	1	ACTIVITY_UPDATED	Activity	56	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 56, "title": "ወላጆቻቸውን ያጡ ህፃናትን መደገፍ ብዛት በቁጥር", "isDone": false, "rollNo": 10, "status": "To Do", "taskId": 14, "weight": "0.2", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T02:52:18.989Z", "updatedAt": "2025-10-13T02:52:33.153Z", "description": null, "targetMetric": {"በቁጥር": "10"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 56, "title": "ወላጆቻቸውን ያጡ ህፃናትን መደገፍ ብዛት በቁጥር", "isDone": false, "rollNo": 10, "status": "To Do", "taskId": 14, "weight": "0.2", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T02:52:18.989Z", "updatedAt": "2025-11-11T13:07:31.756Z", "description": null, "targetMetric": {"በቁጥር": "10"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "10"}, "quarterlyGoals": {"q3": 10}}	2025-11-11 16:07:31.756343+03
62	1	ACTIVITY_UPDATED	Activity	57	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 57, "title": "ወላጆቻቸውን ያጡ ህፃናትን መደገፍ በገንዘብ\\t0.2\\t\\t20,000\\t20,000", "isDone": false, "rollNo": 11, "status": "To Do", "taskId": 14, "weight": "0.02", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:00:56.693Z", "updatedAt": "2025-10-13T03:00:56.693Z", "description": null, "targetMetric": {"በብር": "20,000"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 57, "title": "ወላጆቻቸውን ያጡ ህፃናትን መደገፍ በገንዘብ\\t0.2\\t\\t20,000\\t20,000", "isDone": false, "rollNo": 11, "status": "To Do", "taskId": 14, "weight": "0.02", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:00:56.693Z", "updatedAt": "2025-11-11T13:08:00.509Z", "description": null, "targetMetric": {"በብር": "20000"}, "currentMetric": {}, "previousMetric": {"በብር": "20000"}, "quarterlyGoals": {"q3": 20000}}	2025-11-11 16:08:00.509231+03
63	1	ACTIVITY_UPDATED	Activity	57	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 57, "title": "ወላጆቻቸውን ያጡ ህፃናትን መደገፍ በገንዘብ\\t0.2\\t\\t20,000\\t20,000", "isDone": false, "rollNo": 11, "status": "To Do", "taskId": 14, "weight": "0.02", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:00:56.693Z", "updatedAt": "2025-11-11T13:08:00.509Z", "description": null, "targetMetric": {"በብር": "20000"}, "currentMetric": {}, "previousMetric": {"በብር": "20000"}, "quarterlyGoals": {"q3": 20000}}	{"id": 57, "title": "ወላጆቻቸውን ያጡ ህፃናትን መደገፍ በገንዘብ\\t0.2\\t\\t20,000\\t20,000", "isDone": false, "rollNo": 11, "status": "To Do", "taskId": 14, "weight": "0.02", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:00:56.693Z", "updatedAt": "2025-11-11T13:09:02.814Z", "description": null, "targetMetric": {"በብር": "20000"}, "currentMetric": {}, "previousMetric": {"በብር": "20000"}, "quarterlyGoals": {"q3": 20000}}	2025-11-11 16:09:02.814799+03
64	1	ACTIVITY_UPDATED	Activity	58	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 58, "title": "12 ነባር የአካባቢ ልማት ፕላን ዝግጅት ስራዎችን እንዲፀድቁ ለማድረግ የክትትል ሥራ መስራት", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 15, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:11:50.814Z", "updatedAt": "2025-10-13T03:11:50.814Z", "description": null, "targetMetric": {"በሰነድ": "12"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 58, "title": "12 ነባር የአካባቢ ልማት ፕላን ዝግጅት ስራዎችን እንዲፀድቁ ለማድረግ የክትትል ሥራ መስራት", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 15, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:11:50.814Z", "updatedAt": "2025-11-11T13:13:15.986Z", "description": null, "targetMetric": {"በሰነድ": "12"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	2025-11-11 16:13:15.986513+03
65	1	ACTIVITY_UPDATED	Activity	58	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 58, "title": "12 ነባር የአካባቢ ልማት ፕላን ዝግጅት ስራዎችን እንዲፀድቁ ለማድረግ የክትትል ሥራ መስራት", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 15, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:11:50.814Z", "updatedAt": "2025-11-11T13:13:15.986Z", "description": null, "targetMetric": {"በሰነድ": "12"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 58, "title": "12 ነባር የአካባቢ ልማት ፕላን ዝግጅት ስራዎችን እንዲፀድቁ ለማድረግ የክትትል ሥራ መስራት", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 15, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:11:50.814Z", "updatedAt": "2025-11-11T13:14:39.128Z", "description": null, "targetMetric": {"በሰነድ": "12"}, "currentMetric": {}, "previousMetric": {"በሰነድ": "8"}, "quarterlyGoals": {"q2": 12}}	2025-11-11 16:14:39.128564+03
66	1	ACTIVITY_UPDATED	Activity	59	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 59, "title": "የሰፈር ልማት ፕላኖችን በአማካሪ ድርጅት ማዘጋጀት", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 15, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:12:26.789Z", "updatedAt": "2025-10-13T03:12:26.789Z", "description": null, "targetMetric": {"በቁጥር": "4"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 59, "title": "የሰፈር ልማት ፕላኖችን በአማካሪ ድርጅት ማዘጋጀት", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 15, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:12:26.789Z", "updatedAt": "2025-11-11T13:15:51.278Z", "description": null, "targetMetric": {"በቁጥር": "4"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "6"}, "quarterlyGoals": {"q3": 4}}	2025-11-11 16:15:51.27873+03
67	1	ACTIVITY_UPDATED	Activity	60	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 60, "title": "ለሰፈር ልማት ፕላን ዝግጅት የሚሆኑ 4 መሰረታዊ ካርታዎች ማዘጋጀት", "isDone": false, "rollNo": 3, "status": "To Do", "taskId": 15, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:12:52.172Z", "updatedAt": "2025-10-13T03:12:52.172Z", "description": null, "targetMetric": {"በቁጥር": "4"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 60, "title": "ለሰፈር ልማት ፕላን ዝግጅት የሚሆኑ 4 መሰረታዊ ካርታዎች ማዘጋጀት", "isDone": false, "rollNo": 3, "status": "To Do", "taskId": 15, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:12:52.172Z", "updatedAt": "2025-11-11T13:16:28.720Z", "description": null, "targetMetric": {"በቁጥር": "4"}, "currentMetric": {}, "previousMetric": {"በቁጥር": ""}, "quarterlyGoals": {"q2": 4}}	2025-11-11 16:16:28.720943+03
68	1	ACTIVITY_UPDATED	Activity	61	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 61, "title": "2 በመልሶ ማልማት የከተማ ዲዛይን በተመረጡ የከተማው እንብርት ቦታዎች በራስ አገዝ እንዲሰሩ ማድረግ", "isDone": false, "rollNo": 4, "status": "To Do", "taskId": 15, "weight": "1", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:13:20.427Z", "updatedAt": "2025-10-13T03:13:20.427Z", "description": null, "targetMetric": {"በሰነድ": "2"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 61, "title": "2 በመልሶ ማልማት የከተማ ዲዛይን በተመረጡ የከተማው እንብርት ቦታዎች በራስ አገዝ እንዲሰሩ ማድረግ", "isDone": false, "rollNo": 4, "status": "To Do", "taskId": 15, "weight": "1", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:13:20.427Z", "updatedAt": "2025-11-11T13:17:24.710Z", "description": null, "targetMetric": {"በሰነድ": "2"}, "currentMetric": {}, "previousMetric": {"በሰነድ": "2"}, "quarterlyGoals": {"q2": 1, "q3": 1}}	2025-11-11 16:17:24.710136+03
69	1	ACTIVITY_UPDATED	Activity	62	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 62, "title": "የፕላን ክፍሎችን፣ የማጠቃለያ ሰነዶችንና አሰራር ስታንደርዶችን ማሳተም", "isDone": false, "rollNo": 5, "status": "To Do", "taskId": 15, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:13:44.555Z", "updatedAt": "2025-10-13T03:13:44.555Z", "description": null, "targetMetric": {"በሰነድ": "1"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 62, "title": "የፕላን ክፍሎችን፣ የማጠቃለያ ሰነዶችንና አሰራር ስታንደርዶችን ማሳተም", "isDone": false, "rollNo": 5, "status": "To Do", "taskId": 15, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:13:44.555Z", "updatedAt": "2025-11-11T13:18:10.200Z", "description": null, "targetMetric": {"በሰነድ": "1"}, "currentMetric": {}, "previousMetric": {"በሰነድ": "20"}, "quarterlyGoals": {"q2": 1}}	2025-11-11 16:18:10.200167+03
70	1	ACTIVITY_UPDATED	Activity	63	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 63, "title": "አንድ ቤዚክ ፕላን ለገጠር ጥንስስ ከተማ ማዘጋጀት በራስ አገዝ ማዘጋጀት", "isDone": false, "rollNo": 6, "status": "To Do", "taskId": 15, "weight": "1", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:14:07.004Z", "updatedAt": "2025-10-13T03:14:07.004Z", "description": null, "targetMetric": {"በሰነድ": "1"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 63, "title": "አንድ ቤዚክ ፕላን ለገጠር ጥንስስ ከተማ ማዘጋጀት በራስ አገዝ ማዘጋጀት", "isDone": false, "rollNo": 6, "status": "To Do", "taskId": 15, "weight": "1", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:14:07.004Z", "updatedAt": "2025-11-11T13:18:40.065Z", "description": null, "targetMetric": {"በሰነድ": "1"}, "currentMetric": {}, "previousMetric": {"በሰነድ": "1"}, "quarterlyGoals": {"q3": 1}}	2025-11-11 16:18:40.065547+03
71	1	ACTIVITY_UPDATED	Activity	64	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 64, "title": "በዩን ሃቢታት አየተዘጋጀ ያለው ክልላዊ ሰፓሻል ፕላንን የተረከብነውን በክልል ምክር ቤት እንዲፀድቅ ክትትል ማድረግ", "isDone": false, "rollNo": 7, "status": "To Do", "taskId": 15, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:14:56.397Z", "updatedAt": "2025-10-13T03:14:56.397Z", "description": null, "targetMetric": {"በሰነድ": "1"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 64, "title": "በዩን ሃቢታት አየተዘጋጀ ያለው ክልላዊ ሰፓሻል ፕላንን የተረከብነውን በክልል ምክር ቤት እንዲፀድቅ ክትትል ማድረግ", "isDone": false, "rollNo": 7, "status": "To Do", "taskId": 15, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:14:56.397Z", "updatedAt": "2025-11-11T13:19:07.790Z", "description": null, "targetMetric": {"በሰነድ": "1"}, "currentMetric": {}, "previousMetric": {"በሰነድ": ""}, "quarterlyGoals": {"q4": 1}}	2025-11-11 16:19:07.790721+03
72	1	ACTIVITY_UPDATED	Activity	65	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 65, "title": "በፕላን የሚመሩ የገጠር ማዕከላት ሽፋን ማሳደግ", "isDone": false, "rollNo": 8, "status": "To Do", "taskId": 15, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:15:25.101Z", "updatedAt": "2025-10-13T03:15:25.101Z", "description": null, "targetMetric": {"በመቶኛ": "80"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 65, "title": "በፕላን የሚመሩ የገጠር ማዕከላት ሽፋን ማሳደግ", "isDone": false, "rollNo": 8, "status": "To Do", "taskId": 15, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:15:25.101Z", "updatedAt": "2025-11-11T13:19:45.810Z", "description": null, "targetMetric": {"በመቶኛ": "80"}, "currentMetric": {}, "previousMetric": {"በመቶኛ": "70"}, "quarterlyGoals": {"q2": 75, "q4": 80}}	2025-11-11 16:19:45.810651+03
73	1	ACTIVITY_UPDATED	Activity	66	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 66, "title": "በፕላን የሚመሩ ከተሞች ሽፋን ማሳደግ", "isDone": false, "rollNo": 9, "status": "To Do", "taskId": 15, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:15:49.214Z", "updatedAt": "2025-10-13T03:15:49.214Z", "description": null, "targetMetric": {"በመቶኛ": "80"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 66, "title": "በፕላን የሚመሩ ከተሞች ሽፋን ማሳደግ", "isDone": false, "rollNo": 9, "status": "To Do", "taskId": 15, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:15:49.214Z", "updatedAt": "2025-11-11T13:20:41.037Z", "description": null, "targetMetric": {"በመቶኛ": "80"}, "currentMetric": {}, "previousMetric": {"በመቶኛ": "48"}, "quarterlyGoals": {"q2": 60, "q4": 80}}	2025-11-11 16:20:41.037659+03
74	1	ACTIVITY_UPDATED	Activity	67	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 67, "title": "የሰፈር ልማት ፕላኖች ሽፋን ማሳደግ", "isDone": false, "rollNo": 10, "status": "To Do", "taskId": 15, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:16:16.845Z", "updatedAt": "2025-10-13T03:16:16.845Z", "description": null, "targetMetric": {"በመቶኛ": "55"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 67, "title": "የሰፈር ልማት ፕላኖች ሽፋን ማሳደግ", "isDone": false, "rollNo": 10, "status": "To Do", "taskId": 15, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:16:16.845Z", "updatedAt": "2025-11-11T13:21:18.368Z", "description": null, "targetMetric": {"በመቶኛ": "55"}, "currentMetric": {}, "previousMetric": {"በመቶኛ": "46"}, "quarterlyGoals": {"q2": 50, "q4": 55}}	2025-11-11 16:21:18.368909+03
75	1	ACTIVITY_UPDATED	Activity	68	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 68, "title": "ገጠር ከገጠር እና ገጠር ከከተማ የትስስር ጥናት ማዘጋጀት", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 16, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:17:10.196Z", "updatedAt": "2025-10-13T03:17:10.196Z", "description": null, "targetMetric": {"በሰነድ": "2"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 68, "title": "ገጠር ከገጠር እና ገጠር ከከተማ የትስስር ጥናት ማዘጋጀት", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 16, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:17:10.196Z", "updatedAt": "2025-11-11T13:22:17.107Z", "description": null, "targetMetric": {"በሰነድ": "2"}, "currentMetric": {}, "previousMetric": {"በሰነድ": ""}, "quarterlyGoals": {"q2": 1, "q4": 1}}	2025-11-11 16:22:17.107025+03
76	1	ACTIVITY_UPDATED	Activity	68	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 68, "title": "ገጠር ከገጠር እና ገጠር ከከተማ የትስስር ጥናት ማዘጋጀት", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 16, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:17:10.196Z", "updatedAt": "2025-11-11T13:22:17.107Z", "description": null, "targetMetric": {"በሰነድ": "2"}, "currentMetric": {}, "previousMetric": {"በሰነድ": ""}, "quarterlyGoals": {"q2": 1, "q4": 1}}	{"id": 68, "title": "ገጠር ከገጠር እና ገጠር ከከተማ የትስስር ጥናት ማዘጋጀት", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 16, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:17:10.196Z", "updatedAt": "2025-11-11T13:22:32.988Z", "description": null, "targetMetric": {"በሰነድ": "2"}, "currentMetric": {}, "previousMetric": {"በሰነድ": "0"}, "quarterlyGoals": {"q2": 1, "q4": 1}}	2025-11-11 16:22:32.988146+03
77	1	ACTIVITY_UPDATED	Activity	69	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 69, "title": "የገጠር ኮሪደር ልማት የሚዘጋጅላቸው የገጠር ዕድገት ማእከላት ስኬች ፕላን ጥናቶችን ማዘጋጀት", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 16, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:17:36.115Z", "updatedAt": "2025-10-13T03:17:36.115Z", "description": null, "targetMetric": {"በሰነድ": "6"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 69, "title": "የገጠር ኮሪደር ልማት የሚዘጋጅላቸው የገጠር ዕድገት ማእከላት ስኬች ፕላን ጥናቶችን ማዘጋጀት", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 16, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:17:36.115Z", "updatedAt": "2025-11-11T13:23:42.304Z", "description": null, "targetMetric": {"በሰነድ": "6"}, "currentMetric": {}, "previousMetric": {"በሰነድ": "6"}, "quarterlyGoals": {"q2": 3}}	2025-11-11 16:23:42.304653+03
78	1	ACTIVITY_UPDATED	Activity	70	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 70, "title": "በተዘጋጁ ስኬች ፕላን ጥናት ላይ ለሚመለከታቸው ባለድርሻ አካለት የግንዛቤ መፍጠሪያ መድረክ ማዘጋጀት", "isDone": false, "rollNo": 3, "status": "To Do", "taskId": 16, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:18:01.511Z", "updatedAt": "2025-10-13T03:18:01.511Z", "description": null, "targetMetric": {"በመድረክ": "2"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 70, "title": "በተዘጋጁ ስኬች ፕላን ጥናት ላይ ለሚመለከታቸው ባለድርሻ አካለት የግንዛቤ መፍጠሪያ መድረክ ማዘጋጀት", "isDone": false, "rollNo": 3, "status": "To Do", "taskId": 16, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:18:01.511Z", "updatedAt": "2025-11-11T13:24:22.258Z", "description": null, "targetMetric": {"በመድረክ": "2"}, "currentMetric": {}, "previousMetric": {"በመድረክ": "2"}, "quarterlyGoals": {"q1": 1, "q3": 1}}	2025-11-11 16:24:22.258757+03
79	1	ACTIVITY_UPDATED	Activity	71	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 71, "title": "ከተሞች ወደ Smart city ትግበራ እንዲገቡ ይደረጋል የጥናትና የዝግጅት ምዕራፍ ሥራዎች መስራት", "isDone": false, "rollNo": 4, "status": "To Do", "taskId": 16, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:18:27.658Z", "updatedAt": "2025-10-13T03:18:27.658Z", "description": null, "targetMetric": {"በሰነድ": "1"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 71, "title": "ከተሞች ወደ Smart city ትግበራ እንዲገቡ ይደረጋል የጥናትና የዝግጅት ምዕራፍ ሥራዎች መስራት", "isDone": false, "rollNo": 4, "status": "To Do", "taskId": 16, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:18:27.658Z", "updatedAt": "2025-11-11T13:25:02.993Z", "description": null, "targetMetric": {"በሰነድ": "1"}, "currentMetric": {}, "previousMetric": {"በሰነድ": ""}, "quarterlyGoals": {"q3": 1}}	2025-11-11 16:25:02.993242+03
80	1	ACTIVITY_UPDATED	Activity	72	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 72, "title": "የከተማ ፕላን ዝግጅትና ትግበራን ለማስፈፀም በተዘጋጁ ማኑዋሎች፣ ስታንዳርዶችና የአሰራር ስርአቶች ለባለሙያዎች (50% ሴቶች) ተግባር ተኮር የሆነ ስልጠና ይሰጣል፡፡", "isDone": false, "rollNo": 5, "status": "To Do", "taskId": 16, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:19:01.438Z", "updatedAt": "2025-10-13T03:19:01.438Z", "description": null, "targetMetric": {"በሰልጣኝ በቁጥር": "20"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 72, "title": "የከተማ ፕላን ዝግጅትና ትግበራን ለማስፈፀም በተዘጋጁ ማኑዋሎች፣ ስታንዳርዶችና የአሰራር ስርአቶች ለባለሙያዎች (50% ሴቶች) ተግባር ተኮር የሆነ ስልጠና ይሰጣል፡፡", "isDone": false, "rollNo": 5, "status": "To Do", "taskId": 16, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:19:01.438Z", "updatedAt": "2025-11-11T13:25:46.208Z", "description": null, "targetMetric": {"በሰልጣኝ በቁጥር": "20"}, "currentMetric": {}, "previousMetric": {"በሰልጣኝ በቁጥር": ""}, "quarterlyGoals": {"q2": 20}}	2025-11-11 16:25:46.208803+03
81	1	ACTIVITY_UPDATED	Activity	73	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 73, "title": "የስፓሻል ፕላን ትግበራ ላይ ክትትልና ቁጥጥር ማድረግ", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 17, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:19:58.133Z", "updatedAt": "2025-10-13T03:19:58.133Z", "description": null, "targetMetric": {"በሰነድ": "1"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 73, "title": "የስፓሻል ፕላን ትግበራ ላይ ክትትልና ቁጥጥር ማድረግ", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 17, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:19:58.133Z", "updatedAt": "2025-11-11T13:26:32.601Z", "description": null, "targetMetric": {"በሰነድ": "1"}, "currentMetric": {}, "previousMetric": {"በሰነድ": "1"}, "quarterlyGoals": {"q4": 1}}	2025-11-11 16:26:32.601648+03
82	1	ACTIVITY_UPDATED	Activity	74	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 74, "title": "የአረንጓዴ ልማት ፕላን ትግበራ ላይ ክትትልና ቁጥጥር ማድረግ", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 17, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:20:21.870Z", "updatedAt": "2025-10-13T03:20:21.870Z", "description": null, "targetMetric": {"በሰነድ": "2"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 74, "title": "የአረንጓዴ ልማት ፕላን ትግበራ ላይ ክትትልና ቁጥጥር ማድረግ", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 17, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:20:21.870Z", "updatedAt": "2025-11-11T13:27:08.423Z", "description": null, "targetMetric": {"በሰነድ": "2"}, "currentMetric": {}, "previousMetric": {"በሰነድ": "2"}, "quarterlyGoals": {"q2": 1, "q4": 1}}	2025-11-11 16:27:08.423983+03
83	1	ACTIVITY_UPDATED	Activity	75	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 75, "title": "የማህበረ ኢኮኖሚ ፕላን ትግበራ ላይ ክትትልና ቁጥጥር ማድረግ", "isDone": false, "rollNo": 3, "status": "To Do", "taskId": 17, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:20:43.589Z", "updatedAt": "2025-10-13T03:20:43.589Z", "description": null, "targetMetric": {"በሰነድ": "1"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 75, "title": "የማህበረ ኢኮኖሚ ፕላን ትግበራ ላይ ክትትልና ቁጥጥር ማድረግ", "isDone": false, "rollNo": 3, "status": "To Do", "taskId": 17, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:20:43.589Z", "updatedAt": "2025-11-11T13:27:35.498Z", "description": null, "targetMetric": {"በሰነድ": "1"}, "currentMetric": {}, "previousMetric": {"በሰነድ": "1"}, "quarterlyGoals": {"q4": 1}}	2025-11-11 16:27:35.498105+03
95	1	ACTIVITY_UPDATED	Activity	87	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 87, "title": "የከተማ ፕላን ትግበራ ክዋኔ ኦዲት ማካሄድ", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 19, "weight": "1.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:26:47.774Z", "updatedAt": "2025-10-13T03:26:47.774Z", "description": null, "targetMetric": {"በሰነድ": "1"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 87, "title": "የከተማ ፕላን ትግበራ ክዋኔ ኦዲት ማካሄድ", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 19, "weight": "1.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:26:47.774Z", "updatedAt": "2025-11-11T13:35:58.112Z", "description": null, "targetMetric": {"በሰነድ": "1"}, "currentMetric": {}, "previousMetric": {"በሰነድ": "4"}, "quarterlyGoals": {"q4": 1}}	2025-11-11 16:35:58.112345+03
84	1	ACTIVITY_UPDATED	Activity	76	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 76, "title": "የቅርስ ጥበቃ ፕላን ትግበራ ላይ ክትትልና ቁጥጥር ማድረግ", "isDone": false, "rollNo": 4, "status": "To Do", "taskId": 17, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:21:04.377Z", "updatedAt": "2025-10-13T03:21:04.377Z", "description": null, "targetMetric": {"በሰነድ": "2"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 76, "title": "የቅርስ ጥበቃ ፕላን ትግበራ ላይ ክትትልና ቁጥጥር ማድረግ", "isDone": false, "rollNo": 4, "status": "To Do", "taskId": 17, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:21:04.377Z", "updatedAt": "2025-11-11T13:28:30.669Z", "description": null, "targetMetric": {"በሰነድ": "2"}, "currentMetric": {}, "previousMetric": {"በሰነድ": "2"}, "quarterlyGoals": {"q2": 1, "q4": 1}}	2025-11-11 16:28:30.669607+03
85	1	ACTIVITY_UPDATED	Activity	77	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 77, "title": "የመሬት ሽንሻኖ ፕላን ትግበራ ላይ ክትትልና ቁጥጥር ማድረግ", "isDone": false, "rollNo": 5, "status": "To Do", "taskId": 17, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:21:26.326Z", "updatedAt": "2025-10-13T03:21:26.326Z", "description": null, "targetMetric": {"በሰነድ": "2"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 77, "title": "የመሬት ሽንሻኖ ፕላን ትግበራ ላይ ክትትልና ቁጥጥር ማድረግ", "isDone": false, "rollNo": 5, "status": "To Do", "taskId": 17, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:21:26.326Z", "updatedAt": "2025-11-11T13:29:03.193Z", "description": null, "targetMetric": {"በሰነድ": "2"}, "currentMetric": {}, "previousMetric": {"በሰነድ": "2"}, "quarterlyGoals": {"q2": 1, "q4": 1}}	2025-11-11 16:29:03.193229+03
86	1	ACTIVITY_UPDATED	Activity	78	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 78, "title": "ባለድርሻ ተቋማት በመዋቅራዊ ፕላን ትግበራ የመልሶ ማልማት ፤የቤቶች ልማት፤የቅርስ ጥበቃና የመንገድ መረበብ የትግበራ ፕሮፖዛል በመለየት ከፕሮፖዛሎች አንፃር ስራቸውን ማከናወን በሚያስችል የስራ ትብብር ዙሪያ መግባቢያ ሰነድ መፈራረም", "isDone": false, "rollNo": 6, "status": "To Do", "taskId": 17, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:21:57.101Z", "updatedAt": "2025-10-13T03:21:57.101Z", "description": null, "targetMetric": {"በሰነድ": "4"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 78, "title": "ባለድርሻ ተቋማት በመዋቅራዊ ፕላን ትግበራ የመልሶ ማልማት ፤የቤቶች ልማት፤የቅርስ ጥበቃና የመንገድ መረበብ የትግበራ ፕሮፖዛል በመለየት ከፕሮፖዛሎች አንፃር ስራቸውን ማከናወን በሚያስችል የስራ ትብብር ዙሪያ መግባቢያ ሰነድ መፈራረም", "isDone": false, "rollNo": 6, "status": "To Do", "taskId": 17, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:21:57.101Z", "updatedAt": "2025-11-11T13:29:28.386Z", "description": null, "targetMetric": {"በሰነድ": "4"}, "currentMetric": {}, "previousMetric": {"በሰነድ": "4"}, "quarterlyGoals": {"q1": 4}}	2025-11-11 16:29:28.386825+03
87	1	ACTIVITY_UPDATED	Activity	79	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 79, "title": "ለሚፀድቁት ሰፈር ልማት ፕላን ትግበራ ላይ ክትትልና ቁጥጥር ማድረግ", "isDone": false, "rollNo": 7, "status": "To Do", "taskId": 17, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:22:29.450Z", "updatedAt": "2025-10-13T03:22:29.450Z", "description": null, "targetMetric": {"በሰነድ": "2"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 79, "title": "ለሚፀድቁት ሰፈር ልማት ፕላን ትግበራ ላይ ክትትልና ቁጥጥር ማድረግ", "isDone": false, "rollNo": 7, "status": "To Do", "taskId": 17, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:22:29.450Z", "updatedAt": "2025-11-11T13:29:55.748Z", "description": null, "targetMetric": {"በሰነድ": "2"}, "currentMetric": {}, "previousMetric": {"በሰነድ": "2"}, "quarterlyGoals": {"q2": 1, "q4": 1}}	2025-11-11 16:29:55.748251+03
88	1	ACTIVITY_UPDATED	Activity	80	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 80, "title": "የኤረርና ድሬጠያራ ከተሞች ፕላን ክትትልና ድጋፍ ማድረግ", "isDone": false, "rollNo": 8, "status": "To Do", "taskId": 17, "weight": "0.75", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:22:58.175Z", "updatedAt": "2025-10-13T03:22:58.175Z", "description": null, "targetMetric": {"በሰነድ": "1"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 80, "title": "የኤረርና ድሬጠያራ ከተሞች ፕላን ክትትልና ድጋፍ ማድረግ", "isDone": false, "rollNo": 8, "status": "To Do", "taskId": 17, "weight": "0.75", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:22:58.175Z", "updatedAt": "2025-11-11T13:30:22.610Z", "description": null, "targetMetric": {"በሰነድ": "1"}, "currentMetric": {}, "previousMetric": {"በሰነድ": "0"}, "quarterlyGoals": {"q2": 1}}	2025-11-11 16:30:22.610185+03
89	1	ACTIVITY_UPDATED	Activity	81	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 81, "title": "የከተማ ፕላን ትግበራ ክትትልና ቁጥጥር ሽፋን ማሳደግ", "isDone": false, "rollNo": 9, "status": "To Do", "taskId": 17, "weight": "0.75", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:23:26.077Z", "updatedAt": "2025-10-13T03:23:26.077Z", "description": null, "targetMetric": {"በመቶኛ": "100"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 81, "title": "የከተማ ፕላን ትግበራ ክትትልና ቁጥጥር ሽፋን ማሳደግ", "isDone": false, "rollNo": 9, "status": "To Do", "taskId": 17, "weight": "0.75", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:23:26.077Z", "updatedAt": "2025-11-11T13:30:54.266Z", "description": null, "targetMetric": {"በመቶኛ": "100"}, "currentMetric": {}, "previousMetric": {"በመቶኛ": "70"}, "quarterlyGoals": {"q2": 80, "q4": 100}}	2025-11-11 16:30:54.266223+03
90	1	ACTIVITY_UPDATED	Activity	82	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 82, "title": "የማስተግበሪያ ሰነድ ማዘጋጀት", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 18, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:24:14.540Z", "updatedAt": "2025-10-13T03:24:14.540Z", "description": null, "targetMetric": {"በሰነድ": "1"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 82, "title": "የማስተግበሪያ ሰነድ ማዘጋጀት", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 18, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:24:14.540Z", "updatedAt": "2025-11-11T13:33:06.052Z", "description": null, "targetMetric": {"በሰነድ": "1"}, "currentMetric": {}, "previousMetric": {"በሰነድ": "1"}, "quarterlyGoals": {"q2": 1}}	2025-11-11 16:33:06.052462+03
91	1	ACTIVITY_UPDATED	Activity	83	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 83, "title": "የተዘጋጁ ፕላኖችንና የማስፈጸሚያ ዕቅዶቹ ላይ ስልጠና መስጠት", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 18, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:24:44.128Z", "updatedAt": "2025-10-13T03:24:44.128Z", "description": null, "targetMetric": {"በመድረክ": "2"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 83, "title": "የተዘጋጁ ፕላኖችንና የማስፈጸሚያ ዕቅዶቹ ላይ ስልጠና መስጠት", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 18, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:24:44.128Z", "updatedAt": "2025-11-11T13:33:33.923Z", "description": null, "targetMetric": {"በመድረክ": "2"}, "currentMetric": {}, "previousMetric": {"በመድረክ": "0"}, "quarterlyGoals": {"q2": 1, "q3": 1}}	2025-11-11 16:33:33.923542+03
92	1	ACTIVITY_UPDATED	Activity	84	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 84, "title": "በሚመለከታቸዉ አካላት እንዲፀድቅ ክትትል ማድረግ", "isDone": false, "rollNo": 3, "status": "To Do", "taskId": 18, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:25:10.366Z", "updatedAt": "2025-10-13T03:25:10.366Z", "description": null, "targetMetric": {"በሰነድ": "1"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 84, "title": "በሚመለከታቸዉ አካላት እንዲፀድቅ ክትትል ማድረግ", "isDone": false, "rollNo": 3, "status": "To Do", "taskId": 18, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:25:10.366Z", "updatedAt": "2025-11-11T13:34:06.788Z", "description": null, "targetMetric": {"በሰነድ": "1"}, "currentMetric": {}, "previousMetric": {"በሰነድ": "1"}, "quarterlyGoals": {"q2": 1}}	2025-11-11 16:34:06.78814+03
93	1	ACTIVITY_UPDATED	Activity	85	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 85, "title": "ወረዳዎቹንና የልማት ማዕከላቱን የባለሞያ ድጋፍ መስጠት", "isDone": false, "rollNo": 4, "status": "To Do", "taskId": 18, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:25:34.288Z", "updatedAt": "2025-10-13T03:25:34.288Z", "description": null, "targetMetric": {"በቁጥር": "3"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 85, "title": "ወረዳዎቹንና የልማት ማዕከላቱን የባለሞያ ድጋፍ መስጠት", "isDone": false, "rollNo": 4, "status": "To Do", "taskId": 18, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:25:34.288Z", "updatedAt": "2025-11-11T13:34:41.260Z", "description": null, "targetMetric": {"በቁጥር": "3"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "6"}, "quarterlyGoals": {"q2": 1, "q3": 1, "q4": 1}}	2025-11-11 16:34:41.26052+03
94	1	ACTIVITY_UPDATED	Activity	86	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 86, "title": "የከተማ ፕላን ክዋኔ ኦዲት አመታዊ መርሃ ግብር ማዘጋጀት", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 19, "weight": "1", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:26:20.900Z", "updatedAt": "2025-10-13T03:26:20.900Z", "description": null, "targetMetric": {"በሰነድ": "1"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 86, "title": "የከተማ ፕላን ክዋኔ ኦዲት አመታዊ መርሃ ግብር ማዘጋጀት", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 19, "weight": "1", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:26:20.900Z", "updatedAt": "2025-11-11T13:35:22.753Z", "description": null, "targetMetric": {"በሰነድ": "1"}, "currentMetric": {}, "previousMetric": {"በሰነድ": "2"}, "quarterlyGoals": {"q1": 1}}	2025-11-11 16:35:22.753308+03
96	1	ACTIVITY_UPDATED	Activity	88	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 88, "title": "የመሬት ፍላጎትንና መቸት መለየት", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 20, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:28:08.395Z", "updatedAt": "2025-10-13T03:28:08.395Z", "description": null, "targetMetric": {"ሰነድ": "1"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 88, "title": "የመሬት ፍላጎትንና መቸት መለየት", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 20, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:28:08.395Z", "updatedAt": "2025-11-11T13:37:17.789Z", "description": null, "targetMetric": {"ሰነድ": "1"}, "currentMetric": {}, "previousMetric": {"ሰነድ": "1"}, "quarterlyGoals": {"q1": 1}}	2025-11-11 16:37:17.789007+03
97	1	ACTIVITY_UPDATED	Activity	89	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 89, "title": "የመሬት ማዘጋጀት", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 20, "weight": "0.75", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:29:00.344Z", "updatedAt": "2025-10-13T03:29:00.344Z", "description": null, "targetMetric": {"በሄክታር": "50"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 89, "title": "የመሬት ማዘጋጀት", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 20, "weight": "0.75", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:29:00.344Z", "updatedAt": "2025-11-11T13:38:27.492Z", "description": null, "targetMetric": {"በሄክታር": "50"}, "currentMetric": {}, "previousMetric": {"በሄክታር": "39.01"}, "quarterlyGoals": {"q1": 10, "q2": 15, "q3": 15, "q4": 10}}	2025-11-11 16:38:27.492225+03
98	1	ACTIVITY_UPDATED	Activity	90	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 90, "title": "መሬት ባንክ ገቢ ማድረግ", "isDone": false, "rollNo": 3, "status": "To Do", "taskId": 20, "weight": "0.75", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:29:43.256Z", "updatedAt": "2025-10-13T03:29:43.256Z", "description": null, "targetMetric": {"በሄክታር": "50"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 90, "title": "መሬት ባንክ ገቢ ማድረግ", "isDone": false, "rollNo": 3, "status": "To Do", "taskId": 20, "weight": "0.75", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:29:43.256Z", "updatedAt": "2025-11-11T13:39:02.499Z", "description": null, "targetMetric": {"በሄክታር": "50"}, "currentMetric": {}, "previousMetric": {"በሄክታር": "41"}, "quarterlyGoals": {"q1": 10, "q2": 15, "q3": 15, "q4": 10}}	2025-11-11 16:39:02.499016+03
99	1	ACTIVITY_UPDATED	Activity	91	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 91, "title": "ለተሻሻለው የካሳ አዋጅ ቁጥር 1336/2016 ማስፈጸሚያ ክልላዊ መመርያ እንዲዘጋጅ ይደረጋል", "isDone": false, "rollNo": 4, "status": "To Do", "taskId": 20, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:30:15.143Z", "updatedAt": "2025-10-13T03:30:15.143Z", "description": null, "targetMetric": {"በሰነድ": "1"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 91, "title": "ለተሻሻለው የካሳ አዋጅ ቁጥር 1336/2016 ማስፈጸሚያ ክልላዊ መመርያ እንዲዘጋጅ ይደረጋል", "isDone": false, "rollNo": 4, "status": "To Do", "taskId": 20, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:30:15.143Z", "updatedAt": "2025-11-11T13:39:27.524Z", "description": null, "targetMetric": {"በሰነድ": "1"}, "currentMetric": {}, "previousMetric": {"በሰነድ": ""}, "quarterlyGoals": {"q4": 1}}	2025-11-11 16:39:27.52496+03
100	1	ACTIVITY_UPDATED	Activity	92	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 92, "title": "መሬት ለልማት ማስተላለፍ", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 21, "weight": "0.75", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:31:24.862Z", "updatedAt": "2025-10-13T03:31:24.862Z", "description": null, "targetMetric": {"በሄክታር": "50"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 92, "title": "መሬት ለልማት ማስተላለፍ", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 21, "weight": "0.75", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:31:24.862Z", "updatedAt": "2025-11-11T13:40:10.495Z", "description": null, "targetMetric": {"በሄክታር": "50"}, "currentMetric": {}, "previousMetric": {"በሄክታር": "40.96"}, "quarterlyGoals": {"q1": 10, "q2": 15, "q3": 15, "q4": 10}}	2025-11-11 16:40:10.49596+03
101	1	ACTIVITY_UPDATED	Activity	93	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 93, "title": "ለመኖሪያ ቤት የተላለፈ መሬት", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 21, "weight": "0.75", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:31:49.937Z", "updatedAt": "2025-10-13T03:31:49.937Z", "description": null, "targetMetric": {"በሄክታር": "14"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 93, "title": "ለመኖሪያ ቤት የተላለፈ መሬት", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 21, "weight": "0.75", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:31:49.937Z", "updatedAt": "2025-11-11T13:41:27.930Z", "description": null, "targetMetric": {"በሄክታር": "14"}, "currentMetric": {}, "previousMetric": {"በሄክታር": "6.05"}, "quarterlyGoals": {"q1": 2.8, "q2": 4.2, "q3": 4.2, "q4": 2.8}}	2025-11-11 16:41:27.930484+03
102	1	ACTIVITY_UPDATED	Activity	94	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 94, "title": "ለንግድ አገልግሎት የተላለፈ መሬት", "isDone": false, "rollNo": 3, "status": "To Do", "taskId": 21, "weight": "0.75", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:32:15.173Z", "updatedAt": "2025-10-13T03:32:15.173Z", "description": null, "targetMetric": {"በሄክታር": "5"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 94, "title": "ለንግድ አገልግሎት የተላለፈ መሬት", "isDone": false, "rollNo": 3, "status": "To Do", "taskId": 21, "weight": "0.75", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:32:15.173Z", "updatedAt": "2025-11-11T13:42:09.004Z", "description": null, "targetMetric": {"በሄክታር": "5"}, "currentMetric": {}, "previousMetric": {"በሄክታር": "4.05"}, "quarterlyGoals": {"q1": 1, "q2": 1.5, "q3": 1.5, "q4": 1}}	2025-11-11 16:42:09.004274+03
103	1	ACTIVITY_UPDATED	Activity	95	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 95, "title": "ለማህበራዊ አገልግሎት የተላለፈ መሬት", "isDone": false, "rollNo": 4, "status": "To Do", "taskId": 21, "weight": "0.75", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:32:45.283Z", "updatedAt": "2025-10-13T03:32:45.283Z", "description": null, "targetMetric": {"በሄክታር": "9"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 95, "title": "ለማህበራዊ አገልግሎት የተላለፈ መሬት", "isDone": false, "rollNo": 4, "status": "To Do", "taskId": 21, "weight": "0.75", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:32:45.283Z", "updatedAt": "2025-11-11T13:43:10.934Z", "description": null, "targetMetric": {"በሄክታር": "9"}, "currentMetric": {}, "previousMetric": {"በሄክታር": "8.61"}, "quarterlyGoals": {"q1": 2, "q2": 2.5, "q3": 2.5, "q4": 2}}	2025-11-11 16:43:10.934663+03
104	1	ACTIVITY_UPDATED	Activity	96	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 96, "title": "አስተዳደራዊ አገልግሎት የተላለፈ መሬት", "isDone": false, "rollNo": 5, "status": "To Do", "taskId": 21, "weight": "0.75", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:33:09.188Z", "updatedAt": "2025-10-13T03:33:09.188Z", "description": null, "targetMetric": {"በሄክታር": "4"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 96, "title": "አስተዳደራዊ አገልግሎት የተላለፈ መሬት", "isDone": false, "rollNo": 5, "status": "To Do", "taskId": 21, "weight": "0.75", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:33:09.188Z", "updatedAt": "2025-11-11T13:43:56.394Z", "description": null, "targetMetric": {"በሄክታር": "4"}, "currentMetric": {}, "previousMetric": {"በሄክታር": "6"}, "quarterlyGoals": {"q1": 0.2, "q2": 0.3, "q3": 0.3, "q4": 0.2}}	2025-11-11 16:43:56.39455+03
105	1	ACTIVITY_UPDATED	Activity	97	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 97, "title": "ለኢንዱስትሪ አገልግሎት የተላለፈ መሬት", "isDone": false, "rollNo": 6, "status": "To Do", "taskId": 21, "weight": "0.75", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:33:33.810Z", "updatedAt": "2025-10-13T03:33:33.810Z", "description": null, "targetMetric": {"በሄክታር": "6"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 97, "title": "ለኢንዱስትሪ አገልግሎት የተላለፈ መሬት", "isDone": false, "rollNo": 6, "status": "To Do", "taskId": 21, "weight": "0.75", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:33:33.810Z", "updatedAt": "2025-11-11T13:44:44.656Z", "description": null, "targetMetric": {"በሄክታር": "6"}, "currentMetric": {}, "previousMetric": {"በሄክታር": "3.5"}, "quarterlyGoals": {"q1": 1.2, "q2": 1.8, "q3": 1.8, "q4": 1.2}}	2025-11-11 16:44:44.656734+03
106	1	ACTIVITY_UPDATED	Activity	98	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 98, "title": "ለመንገድ፣ ትራንስፖርትና ዩቲሉቲ ልማት አገልግሎት የተላለፈ መሬት", "isDone": false, "rollNo": 7, "status": "To Do", "taskId": 21, "weight": "0.75", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:34:00.428Z", "updatedAt": "2025-10-13T03:34:00.428Z", "description": null, "targetMetric": {"በሄክታር": "6"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 98, "title": "ለመንገድ፣ ትራንስፖርትና ዩቲሉቲ ልማት አገልግሎት የተላለፈ መሬት", "isDone": false, "rollNo": 7, "status": "To Do", "taskId": 21, "weight": "0.75", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:34:00.428Z", "updatedAt": "2025-11-11T13:45:21.775Z", "description": null, "targetMetric": {"በሄክታር": "6"}, "currentMetric": {}, "previousMetric": {"በሄክታር": "6"}, "quarterlyGoals": {"q1": 1.2, "q2": 1.8, "q3": 1.8, "q4": 1.2}}	2025-11-11 16:45:21.775987+03
107	1	ACTIVITY_UPDATED	Activity	99	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 99, "title": "ለከተማ ግብርና አገልግለሎት የተላለፈ መሬት", "isDone": false, "rollNo": 8, "status": "To Do", "taskId": 21, "weight": "0.75", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:34:24.479Z", "updatedAt": "2025-10-13T03:34:24.479Z", "description": null, "targetMetric": {"በሄክታር": "2"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 99, "title": "ለከተማ ግብርና አገልግለሎት የተላለፈ መሬት", "isDone": false, "rollNo": 8, "status": "To Do", "taskId": 21, "weight": "0.75", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:34:24.479Z", "updatedAt": "2025-11-11T13:46:18.745Z", "description": null, "targetMetric": {"በሄክታር": "2"}, "currentMetric": {}, "previousMetric": {"በሄክታር": "2"}, "quarterlyGoals": {"q2": 1, "q3": 1}}	2025-11-11 16:46:18.745556+03
108	1	ACTIVITY_UPDATED	Activity	100	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 100, "title": "ለአረንጓዴ፣ ለመዝናኛና አከባቢ ጥበቃ የተላለፈ/የተጠበቀ መሬት", "isDone": false, "rollNo": 9, "status": "To Do", "taskId": 21, "weight": "0.75", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:34:53.129Z", "updatedAt": "2025-10-13T03:34:53.129Z", "description": null, "targetMetric": {"በሄክታር": "4"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 100, "title": "ለአረንጓዴ፣ ለመዝናኛና አከባቢ ጥበቃ የተላለፈ/የተጠበቀ መሬት", "isDone": false, "rollNo": 9, "status": "To Do", "taskId": 21, "weight": "0.75", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:34:53.129Z", "updatedAt": "2025-11-11T13:47:02.278Z", "description": null, "targetMetric": {"በሄክታር": "4"}, "currentMetric": {}, "previousMetric": {"በሄክታር": "4.57"}, "quarterlyGoals": {"q1": 1, "q2": 1, "q3": 1, "q4": 1}}	2025-11-11 16:47:02.278264+03
109	1	ACTIVITY_UPDATED	Activity	101	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 101, "title": "አዲስ ይዞታ ማረጋገጫ ማስረጃ መስጠት", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 22, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:35:42.593Z", "updatedAt": "2025-10-13T03:35:42.593Z", "description": null, "targetMetric": {"በቁጥር": "8,000"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 101, "title": "አዲስ ይዞታ ማረጋገጫ ማስረጃ መስጠት", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 22, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:35:42.593Z", "updatedAt": "2025-11-11T13:49:16.360Z", "description": null, "targetMetric": {"በቁጥር": "8000"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "6275"}, "quarterlyGoals": {"q1": 1600, "q2": 2400, "q3": 2400, "q4": 1500}}	2025-11-11 16:49:16.360421+03
110	1	ACTIVITY_UPDATED	Activity	102	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 102, "title": "የመሬት ህገወጥ ይዞታዎችን ማስለቀቅ", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 22, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:36:11.257Z", "updatedAt": "2025-10-13T03:36:11.257Z", "description": null, "targetMetric": {"በሄክታር": "1"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 102, "title": "የመሬት ህገወጥ ይዞታዎችን ማስለቀቅ", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 22, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:36:11.257Z", "updatedAt": "2025-11-11T13:49:51.328Z", "description": null, "targetMetric": {"በሄክታር": "1"}, "currentMetric": {}, "previousMetric": {"በሄክታር": ""}, "quarterlyGoals": {"q1": 0.25, "q2": 0.25, "q3": 0.25, "q4": 0.25}}	2025-11-11 16:49:51.328289+03
111	1	ACTIVITY_UPDATED	Activity	103	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 103, "title": "ለሰነድ አልባ ይዞታዎች እና የመንግስት ተቋም (የቀበሌ እና ኪራይ ቤት) ሰነድ መስጠት", "isDone": false, "rollNo": 3, "status": "To Do", "taskId": 22, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:36:37.990Z", "updatedAt": "2025-10-13T03:36:37.990Z", "description": null, "targetMetric": {"በቁጥር": "4,500"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 103, "title": "ለሰነድ አልባ ይዞታዎች እና የመንግስት ተቋም (የቀበሌ እና ኪራይ ቤት) ሰነድ መስጠት", "isDone": false, "rollNo": 3, "status": "To Do", "taskId": 22, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:36:37.990Z", "updatedAt": "2025-11-11T13:51:47.320Z", "description": null, "targetMetric": {"በቁጥር": "4500"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "3672"}, "quarterlyGoals": {"q1": 900, "q2": 1350, "q3": 1350, "q4": 900}}	2025-11-11 16:51:47.320152+03
112	1	ACTIVITY_UPDATED	Activity	104	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 104, "title": "የመሬት ይዞታን ማሻሻል", "isDone": false, "rollNo": 4, "status": "To Do", "taskId": 22, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:37:14.680Z", "updatedAt": "2025-10-13T03:37:14.680Z", "description": null, "targetMetric": {"በቁጥር": "1,000"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 104, "title": "የመሬት ይዞታን ማሻሻል", "isDone": false, "rollNo": 4, "status": "To Do", "taskId": 22, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:37:14.680Z", "updatedAt": "2025-11-11T13:53:04.130Z", "description": null, "targetMetric": {"በቁጥር": "1000"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "789"}, "quarterlyGoals": {"q1": 200, "q2": 300, "q3": 300, "q4": 200}}	2025-11-11 16:53:04.13012+03
118	1	ACTIVITY_UPDATED	Activity	110	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 110, "title": "ካደስተር ምዝገባዉ ተደራሽ ማድረግ", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 24, "weight": "0.75", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:43:29.910Z", "updatedAt": "2025-10-13T03:43:29.910Z", "description": null, "targetMetric": {"በቁጥር": "15,000"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 110, "title": "ካደስተር ምዝገባዉ ተደራሽ ማድረግ", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 24, "weight": "0.75", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:43:29.910Z", "updatedAt": "2025-11-11T14:03:23.642Z", "description": null, "targetMetric": {"በቁጥር": "15000"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "7600"}, "quarterlyGoals": {"q1": 2500, "q2": 3750, "q3": 3750, "q4": 2500}}	2025-11-11 17:03:23.642741+03
113	1	ACTIVITY_UPDATED	Activity	105	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 105, "title": "በክልሉ 5,000 በቁራሽ መሬት (10 ሄክታር) ላይ የሚገኝ የመሬት ሀብታቸውን ቆጥረውና መዝግበው ወቅታዊ እንዲያደርጉና እንዲያስተዳድሩ ይደረጋል", "isDone": false, "rollNo": 5, "status": "To Do", "taskId": 22, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:38:03.636Z", "updatedAt": "2025-10-13T03:38:03.636Z", "description": null, "targetMetric": {"በቁራሽ መሬት ብዛት": "5,000"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 105, "title": "በክልሉ 5,000 በቁራሽ መሬት (10 ሄክታር) ላይ የሚገኝ የመሬት ሀብታቸውን ቆጥረውና መዝግበው ወቅታዊ እንዲያደርጉና እንዲያስተዳድሩ ይደረጋል", "isDone": false, "rollNo": 5, "status": "To Do", "taskId": 22, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:38:03.636Z", "updatedAt": "2025-11-11T13:55:43.960Z", "description": null, "targetMetric": {"በቁራሽ መሬት ብዛት": "1000"}, "currentMetric": {}, "previousMetric": {"በቁራሽ መሬት ብዛት": "5000"}, "quarterlyGoals": {"q1": 1000, "q2": 1500, "q3": 1500, "q4": 1000}}	2025-11-11 16:55:43.960766+03
114	1	ACTIVITY_UPDATED	Activity	106	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 106, "title": "በክልሉ 5,000 በቁራሽ መሬት (10 ሄክታር) ላይ የሚገኝ የመሬት ሀብታቸውን ቆጥረውና መዝግበው ወቅታዊ እንዲያደርጉና እንዲያስተዳድሩ ይደረጋል", "isDone": false, "rollNo": 6, "status": "To Do", "taskId": 22, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:39:14.463Z", "updatedAt": "2025-10-13T03:39:14.463Z", "description": null, "targetMetric": {"በሄክታር": "10"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 106, "title": "በክልሉ 5,000 በቁራሽ መሬት (10 ሄክታር) ላይ የሚገኝ የመሬት ሀብታቸውን ቆጥረውና መዝግበው ወቅታዊ እንዲያደርጉና እንዲያስተዳድሩ ይደረጋል", "isDone": false, "rollNo": 6, "status": "To Do", "taskId": 22, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:39:14.463Z", "updatedAt": "2025-11-11T13:56:51.311Z", "description": null, "targetMetric": {"በሄክታር": "10"}, "currentMetric": {}, "previousMetric": {"በሄክታር": ""}, "quarterlyGoals": {"q1": 2, "q2": 3, "q3": 3, "q4": 2}}	2025-11-11 16:56:51.311083+03
115	1	ACTIVITY_UPDATED	Activity	107	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 107, "title": "ከመሬት ነክ ቋሚ ንብረት ገቢን ማሰባሰብ", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 23, "weight": "1.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:40:21.902Z", "updatedAt": "2025-10-13T03:40:21.902Z", "description": null, "targetMetric": {"በብር": "500,000,000"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 107, "title": "ከመሬት ነክ ቋሚ ንብረት ገቢን ማሰባሰብ", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 23, "weight": "1.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:40:21.902Z", "updatedAt": "2025-11-11T13:58:49.714Z", "description": null, "targetMetric": {"በብር": "500000000"}, "currentMetric": {}, "previousMetric": {"በብር": "34563136000"}, "quarterlyGoals": {"q1": 100000, "q2": 150000, "q3": 150000, "q4": 100000}}	2025-11-11 16:58:49.714651+03
116	1	ACTIVITY_UPDATED	Activity	108	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 108, "title": "ለልማት ተነሺዎች ካሳ መክፈል", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 23, "weight": "1.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:40:47.299Z", "updatedAt": "2025-10-13T03:41:31.020Z", "description": null, "targetMetric": {"በብር": "200,000,000"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 108, "title": "ለልማት ተነሺዎች ካሳ መክፈል", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 23, "weight": "1.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:40:47.299Z", "updatedAt": "2025-11-11T14:00:14.068Z", "description": null, "targetMetric": {"በብር": "200000000"}, "currentMetric": {}, "previousMetric": {"በብር": "21329005300"}, "quarterlyGoals": {"q1": 40000, "q2": 60000, "q3": 60000, "q4": 40000}}	2025-11-11 17:00:14.068669+03
117	1	ACTIVITY_UPDATED	Activity	109	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 109, "title": "የመሬት ይዞታ ማህደራትን ማደራጀት", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 24, "weight": "0.75", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:42:58.275Z", "updatedAt": "2025-10-13T03:42:58.275Z", "description": null, "targetMetric": {"በቁጥር": "12,500"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 109, "title": "የመሬት ይዞታ ማህደራትን ማደራጀት", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 24, "weight": "0.75", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:42:58.275Z", "updatedAt": "2025-11-11T14:01:40.109Z", "description": null, "targetMetric": {"በቁጥር": "12500"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "15909"}, "quarterlyGoals": {"q1": 2500, "q2": 3750, "q3": 3750, "q4": 2500}}	2025-11-11 17:01:40.109294+03
119	1	ACTIVITY_UPDATED	Activity	111	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 111, "title": "የህጋዊ ካዳስተር ስርዓትን ለመተግበር የሚያስፈልጉ የሲስተም ፣ ማረጋገጥና ምዝገባ ግብአቶችን እንዲሟላ ስፔስፊኬሽን ሰነድ ማዘጋጀት", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 25, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:44:56.524Z", "updatedAt": "2025-10-13T03:44:56.524Z", "description": null, "targetMetric": {"የስፔስፊኬሽን ሰነድ": "1"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 111, "title": "የህጋዊ ካዳስተር ስርዓትን ለመተግበር የሚያስፈልጉ የሲስተም ፣ ማረጋገጥና ምዝገባ ግብአቶችን እንዲሟላ ስፔስፊኬሽን ሰነድ ማዘጋጀት", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 25, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:44:56.524Z", "updatedAt": "2025-11-11T14:04:18.761Z", "description": null, "targetMetric": {"የስፔስፊኬሽን ሰነድ": "1"}, "currentMetric": {}, "previousMetric": {"የስፔስፊኬሽን ሰነድ": "1"}, "quarterlyGoals": {"q1": 1}}	2025-11-11 17:04:18.761534+03
120	1	ACTIVITY_UPDATED	Activity	112	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 112, "title": "ቅሬታ ሰሚ ጉባኤ ማደራጀትና ታዛቢ ኮሚቴ ማዋቀር", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 25, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:45:29.066Z", "updatedAt": "2025-10-13T03:45:29.066Z", "description": null, "targetMetric": {"በቀጠና ብዛት": "4"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 112, "title": "ቅሬታ ሰሚ ጉባኤ ማደራጀትና ታዛቢ ኮሚቴ ማዋቀር", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 25, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:45:29.066Z", "updatedAt": "2025-11-11T14:05:01.225Z", "description": null, "targetMetric": {"በቀጠና ብዛት": "4"}, "currentMetric": {}, "previousMetric": {"በቀጠና ብዛት": "4"}, "quarterlyGoals": {"q1": 1, "q2": 1, "q3": 1, "q4": 1}}	2025-11-11 17:05:01.225677+03
121	1	ACTIVITY_UPDATED	Activity	113	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 113, "title": "ለተመረጡ ቅሬታ ሰሚ ጉባኤ እና ታዛቢ ኮሚቴ አባላት ማበረታቻ ክፍያ መመሪያ ማዘጋጀት", "isDone": false, "rollNo": 3, "status": "To Do", "taskId": 25, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:46:10.418Z", "updatedAt": "2025-10-13T03:46:10.418Z", "description": null, "targetMetric": {"በሰነድ": "1"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 113, "title": "ለተመረጡ ቅሬታ ሰሚ ጉባኤ እና ታዛቢ ኮሚቴ አባላት ማበረታቻ ክፍያ መመሪያ ማዘጋጀት", "isDone": false, "rollNo": 3, "status": "To Do", "taskId": 25, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:46:10.418Z", "updatedAt": "2025-11-11T14:05:38.190Z", "description": null, "targetMetric": {"በሰነድ": "1"}, "currentMetric": {}, "previousMetric": {"በሰነድ": ""}, "quarterlyGoals": {"q1": 1}}	2025-11-11 17:05:38.190677+03
122	1	ACTIVITY_UPDATED	Activity	114	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 114, "title": "ከመብት ፈጣሪ ተቋም (መሬት ልማት ማኔጅመንት) የተደራጁ የይዞታ ፋይሎችን በደንቡ መሰረት መረከብ", "isDone": false, "rollNo": 4, "status": "To Do", "taskId": 25, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:46:51.232Z", "updatedAt": "2025-10-13T03:46:51.232Z", "description": null, "targetMetric": {"በተረከበ ፋይል ቁጥር": "15,000"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 114, "title": "ከመብት ፈጣሪ ተቋም (መሬት ልማት ማኔጅመንት) የተደራጁ የይዞታ ፋይሎችን በደንቡ መሰረት መረከብ", "isDone": false, "rollNo": 4, "status": "To Do", "taskId": 25, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:46:51.232Z", "updatedAt": "2025-11-11T14:06:35.249Z", "description": null, "targetMetric": {"በተረከበ ፋይል ቁጥር": "15000"}, "currentMetric": {}, "previousMetric": {"በተረከበ ፋይል ቁጥር": "7640"}, "quarterlyGoals": {"q1": 3000, "q2": 4500, "q3": 4500, "q4": 3000}}	2025-11-11 17:06:35.249926+03
123	1	ACTIVITY_UPDATED	Activity	115	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 115, "title": "ሕጋዊ ካዳስተር ለመተግበር ለፈጻሚዎችንና አስፈጻሚ አካላት የግንዛቤ ማስጨበጫ ስልጠና መስጠት", "isDone": false, "rollNo": 5, "status": "To Do", "taskId": 25, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:47:14.801Z", "updatedAt": "2025-10-13T03:47:14.801Z", "description": null, "targetMetric": {"በመድረክ": "3"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 115, "title": "ሕጋዊ ካዳስተር ለመተግበር ለፈጻሚዎችንና አስፈጻሚ አካላት የግንዛቤ ማስጨበጫ ስልጠና መስጠት", "isDone": false, "rollNo": 5, "status": "To Do", "taskId": 25, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:47:14.801Z", "updatedAt": "2025-11-11T14:07:12.364Z", "description": null, "targetMetric": {"በመድረክ": "3"}, "currentMetric": {}, "previousMetric": {"በመድረክ": "3"}, "quarterlyGoals": {"q1": 1, "q2": 1, "q3": 1}}	2025-11-11 17:07:12.36466+03
124	1	ACTIVITY_UPDATED	Activity	116	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 116, "title": "የከተማ መሬት ምዝገባ ፕሮግራም ለማስፈጸም የሚያስችል ለህብረተሰብ ግንዛቤ ማስጨበጫ መስጠት", "isDone": false, "rollNo": 6, "status": "To Do", "taskId": 25, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:47:38.381Z", "updatedAt": "2025-10-13T03:47:38.381Z", "description": null, "targetMetric": {"በመድረክ": "4"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 116, "title": "የከተማ መሬት ምዝገባ ፕሮግራም ለማስፈጸም የሚያስችል ለህብረተሰብ ግንዛቤ ማስጨበጫ መስጠት", "isDone": false, "rollNo": 6, "status": "To Do", "taskId": 25, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:47:38.381Z", "updatedAt": "2025-11-11T14:08:02.054Z", "description": null, "targetMetric": {"በመድረክ": "4"}, "currentMetric": {}, "previousMetric": {"በመድረክ": "4"}, "quarterlyGoals": {"q1": 1, "q2": 1, "q3": 1, "q4": 1}}	2025-11-11 17:08:02.054999+03
125	1	ACTIVITY_UPDATED	Activity	117	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 117, "title": "ኦርቶፎቶ በመጠቀም ለመሬት ይዞታ ማረጋገጫ ማከናወኛ ካርታና ኢንዴክስ ማፕ ማዘጋጀት", "isDone": false, "rollNo": 7, "status": "To Do", "taskId": 25, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:48:01.719Z", "updatedAt": "2025-10-13T03:48:18.688Z", "description": null, "targetMetric": {"በቁራሽ መሬት በቁጥር": "15,000"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 117, "title": "ኦርቶፎቶ በመጠቀም ለመሬት ይዞታ ማረጋገጫ ማከናወኛ ካርታና ኢንዴክስ ማፕ ማዘጋጀት", "isDone": false, "rollNo": 7, "status": "To Do", "taskId": 25, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:48:01.719Z", "updatedAt": "2025-11-11T14:08:56.870Z", "description": null, "targetMetric": {"በቁራሽ መሬት በቁጥር": "15000"}, "currentMetric": {}, "previousMetric": {"በቁራሽ መሬት በቁጥር": "14200"}, "quarterlyGoals": {"q1": 3000, "q2": 4500, "q3": 4500, "q4": 3000}}	2025-11-11 17:08:56.87086+03
126	1	ACTIVITY_UPDATED	Activity	118	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 118, "title": "ከባለድረሻ አካላት ጋር MOU መፈራረም", "isDone": false, "rollNo": 8, "status": "To Do", "taskId": 25, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:48:43.115Z", "updatedAt": "2025-10-13T03:48:43.115Z", "description": null, "targetMetric": {"የተዘጋጀ ሰነድ": "13"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 118, "title": "ከባለድረሻ አካላት ጋር MOU መፈራረም", "isDone": false, "rollNo": 8, "status": "To Do", "taskId": 25, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:48:43.115Z", "updatedAt": "2025-11-11T14:09:24.441Z", "description": null, "targetMetric": {"የተዘጋጀ ሰነድ": "13"}, "currentMetric": {}, "previousMetric": {"የተዘጋጀ ሰነድ": "1"}, "quarterlyGoals": {"q1": 13}}	2025-11-11 17:09:24.441338+03
127	1	ACTIVITY_UPDATED	Activity	119	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 119, "title": "በተመረጡ ቀጠናዎች ውስጥ ይዞታዎችን የወሰን ማካለል ስራ መስራት", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 26, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:49:36.429Z", "updatedAt": "2025-10-13T03:49:36.429Z", "description": null, "targetMetric": {"በቁራሽ መሬት በቁጥር": "15,000"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 119, "title": "በተመረጡ ቀጠናዎች ውስጥ ይዞታዎችን የወሰን ማካለል ስራ መስራት", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 26, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:49:36.429Z", "updatedAt": "2025-11-11T14:10:27.662Z", "description": null, "targetMetric": {"በቁራሽ መሬት በቁጥር": "3000"}, "currentMetric": {}, "previousMetric": {"በቁራሽ መሬት በቁጥር": "15000"}, "quarterlyGoals": {"q1": 3000, "q2": 4500, "q3": 4500, "q4": 3000}}	2025-11-11 17:10:27.662709+03
128	1	ACTIVITY_UPDATED	Activity	120	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 120, "title": "በተመረጡ ቀጠናዎች ውስጥ ይዞታዎችን የቅየሳ ስራ መስራት", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 26, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:50:17.073Z", "updatedAt": "2025-10-13T03:50:17.073Z", "description": null, "targetMetric": {"በቁራሽ መሬት በቁጥር": "15,000"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 120, "title": "በተመረጡ ቀጠናዎች ውስጥ ይዞታዎችን የቅየሳ ስራ መስራት", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 26, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:50:17.073Z", "updatedAt": "2025-11-11T14:11:13.351Z", "description": null, "targetMetric": {"በቁራሽ መሬት በቁጥር": "3000"}, "currentMetric": {}, "previousMetric": {"በቁራሽ መሬት በቁጥር": "15000"}, "quarterlyGoals": {"q1": 4500, "q2": 4500, "q3": 4500, "q4": 3000}}	2025-11-11 17:11:13.35195+03
129	1	ACTIVITY_UPDATED	Activity	121	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 121, "title": "የመሬት ይዞታን ማረጋገጥ", "isDone": false, "rollNo": 3, "status": "To Do", "taskId": 26, "weight": "2", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:50:51.131Z", "updatedAt": "2025-10-13T03:51:06.387Z", "description": null, "targetMetric": {"በቁራሽ መሬት በቁጥር": "15,000"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 121, "title": "የመሬት ይዞታን ማረጋገጥ", "isDone": false, "rollNo": 3, "status": "To Do", "taskId": 26, "weight": "2", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:50:51.131Z", "updatedAt": "2025-11-11T14:12:27.899Z", "description": null, "targetMetric": {"በቁራሽ መሬት በቁጥር": "15000"}, "currentMetric": {}, "previousMetric": {"በቁራሽ መሬት በቁጥር": "12486"}, "quarterlyGoals": {"q1": 3000, "q2": 4500, "q3": 4500, "q4": 3000}}	2025-11-11 17:12:27.899409+03
130	1	ACTIVITY_UPDATED	Activity	122	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 122, "title": "የመሬት ይዞታ ማህደሮች ከኦርቶፎቶ/ከካዳስተር መሰረታዊ ካርታ ጋር በቁራሽ መሬት ልዩ ኮድ እንዲተሳሰሩ ማድረግ", "isDone": false, "rollNo": 4, "status": "To Do", "taskId": 26, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:51:44.855Z", "updatedAt": "2025-10-13T03:51:44.855Z", "description": null, "targetMetric": {"በይዞታ ቁጥር": "15,000"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 122, "title": "የመሬት ይዞታ ማህደሮች ከኦርቶፎቶ/ከካዳስተር መሰረታዊ ካርታ ጋር በቁራሽ መሬት ልዩ ኮድ እንዲተሳሰሩ ማድረግ", "isDone": false, "rollNo": 4, "status": "To Do", "taskId": 26, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:51:44.855Z", "updatedAt": "2025-11-11T14:13:21.412Z", "description": null, "targetMetric": {"በይዞታ ቁጥር": "15000"}, "currentMetric": {}, "previousMetric": {"በይዞታ ቁጥር": ""}, "quarterlyGoals": {"q1": 3000, "q2": 4500, "q3": 4500, "q4": 3000}}	2025-11-11 17:13:21.412638+03
131	1	ACTIVITY_UPDATED	Activity	123	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 123, "title": "የካዳስተር ቁራሽ መሬት የይዞታ ማረጋገጫ ካርታ እንዲዘጋጅ ማድረግ", "isDone": false, "rollNo": 5, "status": "To Do", "taskId": 26, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:52:12.092Z", "updatedAt": "2025-10-13T03:52:12.092Z", "description": null, "targetMetric": {"የይዞታ ማረጋገጫ ካርታ በቁጥር": "15,000"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 123, "title": "የካዳስተር ቁራሽ መሬት የይዞታ ማረጋገጫ ካርታ እንዲዘጋጅ ማድረግ", "isDone": false, "rollNo": 5, "status": "To Do", "taskId": 26, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:52:12.092Z", "updatedAt": "2025-11-11T14:14:12.878Z", "description": null, "targetMetric": {"የይዞታ ማረጋገጫ ካርታ በቁጥር": "15000"}, "currentMetric": {}, "previousMetric": {"የይዞታ ማረጋገጫ ካርታ በቁጥር": ""}, "quarterlyGoals": {"q1": 3000, "q2": 4500, "q3": 4500, "q4": 3000}}	2025-11-11 17:14:12.878034+03
132	1	ACTIVITY_UPDATED	Activity	124	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 124, "title": "የአድራሻ ስርዓት ካርታ በአማካሪ የትግበራ አፕሊኬሽን እንዲዘጋጅ ማድረግ", "isDone": false, "rollNo": 6, "status": "To Do", "taskId": 26, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:52:37.150Z", "updatedAt": "2025-10-13T03:52:37.150Z", "description": null, "targetMetric": {"በከተማ ቁጥር": "1"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 124, "title": "የአድራሻ ስርዓት ካርታ በአማካሪ የትግበራ አፕሊኬሽን እንዲዘጋጅ ማድረግ", "isDone": false, "rollNo": 6, "status": "To Do", "taskId": 26, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:52:37.150Z", "updatedAt": "2025-11-11T14:15:13.391Z", "description": null, "targetMetric": {"በከተማ ቁጥር": "1"}, "currentMetric": {}, "previousMetric": {"በከተማ ቁጥር": ""}, "quarterlyGoals": {"q1": 1}}	2025-11-11 17:15:13.391166+03
133	1	ACTIVITY_UPDATED	Activity	125	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 125, "title": "ምዝገባ ለተደረገላቸው ይዞታዎች ለሚሰጡ አገልግሎቶች አገልግሎት አሰጣጡ ወጪና ጊዜ ቆጣቢ፣ ፈጣንና ተደራሽ እንዲሆን ክትትልና ድጋፍ ማድረግ", "isDone": false, "rollNo": 7, "status": "To Do", "taskId": 26, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:53:01.409Z", "updatedAt": "2025-10-13T03:53:01.409Z", "description": null, "targetMetric": {"አገልግሎት ያገኙ ባለይዞታዎች በቁጥር": "6000"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 125, "title": "ምዝገባ ለተደረገላቸው ይዞታዎች ለሚሰጡ አገልግሎቶች አገልግሎት አሰጣጡ ወጪና ጊዜ ቆጣቢ፣ ፈጣንና ተደራሽ እንዲሆን ክትትልና ድጋፍ ማድረግ", "isDone": false, "rollNo": 7, "status": "To Do", "taskId": 26, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:53:01.409Z", "updatedAt": "2025-11-11T14:15:44.497Z", "description": null, "targetMetric": {"አገልግሎት ያገኙ ባለይዞታዎች በቁጥር": "6000"}, "currentMetric": {}, "previousMetric": {"አገልግሎት ያገኙ ባለይዞታዎች በቁጥር": ""}, "quarterlyGoals": {"q1": 1200, "q2": 1800, "q3": 1800, "q4": 1200}}	2025-11-11 17:15:44.497132+03
134	1	ACTIVITY_UPDATED	Activity	126	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 126, "title": "በማረጋገጥ ሂደቱ ብቁ የሆኑትን ይዞታወችን በሲስተም በመመዝገብ የምዝገባ ሰርቲፊኬት መስጠት", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 27, "weight": "1", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:53:50.831Z", "updatedAt": "2025-10-13T03:53:50.831Z", "description": null, "targetMetric": {"በቁጥር": "6,500"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 126, "title": "በማረጋገጥ ሂደቱ ብቁ የሆኑትን ይዞታወችን በሲስተም በመመዝገብ የምዝገባ ሰርቲፊኬት መስጠት", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 27, "weight": "1", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:53:50.831Z", "updatedAt": "2025-11-11T14:16:52.253Z", "description": null, "targetMetric": {"በቁጥር": "6500"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "2063"}, "quarterlyGoals": {"q1": 1300, "q2": 1950, "q3": 1950, "q4": 1300}}	2025-11-11 17:16:52.253785+03
135	1	ACTIVITY_UPDATED	Activity	127	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 127, "title": "በማረጋገጥ ሂደቱ ብቁ የሆኑትን ይዞታወችን በማንዋል በመመዝገብ የምዝገባ ሰርቲፊኬት መስጠት", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 27, "weight": "1", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:55:06.209Z", "updatedAt": "2025-10-13T03:55:06.209Z", "description": null, "targetMetric": {"በቁጥር": "6,000"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 127, "title": "በማረጋገጥ ሂደቱ ብቁ የሆኑትን ይዞታወችን በማንዋል በመመዝገብ የምዝገባ ሰርቲፊኬት መስጠት", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 27, "weight": "1", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:55:06.209Z", "updatedAt": "2025-11-11T14:18:27.120Z", "description": null, "targetMetric": {"በቁጥር": "6000"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "3325"}, "quarterlyGoals": {"q1": 1200, "q2": 1800, "q3": 1800, "q4": 1200}}	2025-11-11 17:18:27.120668+03
136	1	ACTIVITY_UPDATED	Activity	128	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 128, "title": "የመሬት ይዞታ ማረጋገጥና ምዝገባ አገልገሎት መስጠት", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 28, "weight": "1", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:56:31.417Z", "updatedAt": "2025-10-13T03:56:31.417Z", "description": null, "targetMetric": {"በቁጥር": "6,000"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 128, "title": "የመሬት ይዞታ ማረጋገጥና ምዝገባ አገልገሎት መስጠት", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 28, "weight": "1", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:56:31.417Z", "updatedAt": "2025-11-11T14:19:51.509Z", "description": null, "targetMetric": {"በቁጥር": "6000"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "3325"}, "quarterlyGoals": {"q1": 1200, "q2": 1800, "q3": 1800, "q4": 1200}}	2025-11-11 17:19:51.509516+03
137	1	ACTIVITY_UPDATED	Activity	129	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 129, "title": "በሲስተም የተመዘገቡትን ይዞታዎች አገልገሎት በመስጠት ገቢ መሰብሰብ", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 28, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:57:31.599Z", "updatedAt": "2025-10-13T03:57:31.599Z", "description": null, "targetMetric": {"በብር": "10,000,000"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 129, "title": "በሲስተም የተመዘገቡትን ይዞታዎች አገልገሎት በመስጠት ገቢ መሰብሰብ", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 28, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:57:31.599Z", "updatedAt": "2025-11-11T14:20:59.741Z", "description": null, "targetMetric": {"በብር": "10000000"}, "currentMetric": {}, "previousMetric": {"በብር": "4950500"}, "quarterlyGoals": {"q1": 2000000, "q2": 3000000, "q3": 3000000, "q4": 2000000}}	2025-11-11 17:20:59.741959+03
138	1	ACTIVITY_UPDATED	Activity	130	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 130, "title": "የካዳስተርን ሽፋን ማሳደግ", "isDone": false, "rollNo": 3, "status": "To Do", "taskId": 28, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:57:55.286Z", "updatedAt": "2025-10-13T03:57:55.286Z", "description": null, "targetMetric": {"በመቶኛ": "60"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 130, "title": "የካዳስተርን ሽፋን ማሳደግ", "isDone": false, "rollNo": 3, "status": "To Do", "taskId": 28, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:57:55.286Z", "updatedAt": "2025-11-11T14:22:03.386Z", "description": null, "targetMetric": {"በመቶኛ": "60"}, "currentMetric": {}, "previousMetric": {"በመቶኛ": "16"}, "quarterlyGoals": {"q2": 35, "q4": 60}}	2025-11-11 17:22:03.386055+03
144	1	ACTIVITY_UPDATED	Activity	135	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 135, "title": "የሪል ፕሮፐርቲ ዳታ ቤዝ ማልማት", "isDone": false, "rollNo": 5, "status": "To Do", "taskId": 29, "weight": "0.167", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:02:18.660Z", "updatedAt": "2025-10-13T04:02:18.660Z", "description": null, "targetMetric": {"በቄጥር": "1"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 135, "title": "የሪል ፕሮፐርቲ ዳታ ቤዝ ማልማት", "isDone": false, "rollNo": 5, "status": "To Do", "taskId": 29, "weight": "0.167", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:02:18.660Z", "updatedAt": "2025-11-12T18:37:38.371Z", "description": null, "targetMetric": {"በቄጥር": "1"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {"q2": 1}}	2025-11-12 21:37:38.371353+03
139	1	ACTIVITY_UPDATED	Activity	131	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 131, "title": "በከተሞች ለንብረት ግመታ የከተማ ቦታ ደረጃ መመሪያ እና የከተማ ቦታና ቤት ግብር ደንብ ማሻሻል ፣", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 29, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:59:04.584Z", "updatedAt": "2025-10-13T03:59:04.584Z", "description": null, "targetMetric": {"በሰነድ": "2"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 131, "title": "በከተሞች ለንብረት ግመታ የከተማ ቦታ ደረጃ መመሪያ እና የከተማ ቦታና ቤት ግብር ደንብ ማሻሻል ፣", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 29, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:59:04.584Z", "updatedAt": "2025-11-12T18:34:29.264Z", "description": null, "targetMetric": {"በሰነድ": "2"}, "currentMetric": {}, "previousMetric": {"በሰነድ": "1"}, "quarterlyGoals": {"q1": 1, "q2": 1}}	2025-11-12 21:34:29.264701+03
140	1	ACTIVITY_UPDATED	Activity	132	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 132, "title": "በከተሞች የሪል ንብረቶች ዋጋ ግመታ በማካሄድ ገቢ መሰብሰብ፣", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 29, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:59:40.775Z", "updatedAt": "2025-10-13T03:59:40.775Z", "description": null, "targetMetric": {"በብር": "200,000,000"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 132, "title": "በከተሞች የሪል ንብረቶች ዋጋ ግመታ በማካሄድ ገቢ መሰብሰብ፣", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 29, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:59:40.775Z", "updatedAt": "2025-11-12T18:35:31.562Z", "description": null, "targetMetric": {"በብር": "200000000"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {"q1": 40000000, "q2": 60000000, "q3": 60000000, "q4": 40000000}}	2025-11-12 21:35:31.562124+03
141	1	ACTIVITY_UPDATED	Activity	133	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 133, "title": "በከተሞች የሪል ንብረቶች ዋጋ ግመታ በማካሄድ ሽፋኑን 70 በመቶ ማድረስ፣", "isDone": false, "rollNo": 3, "status": "To Do", "taskId": 29, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:00:14.179Z", "updatedAt": "2025-10-13T04:00:14.179Z", "description": null, "targetMetric": {"በመቶኛ": "70"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 133, "title": "በከተሞች የሪል ንብረቶች ዋጋ ግመታ በማካሄድ ሽፋኑን 70 በመቶ ማድረስ፣", "isDone": false, "rollNo": 3, "status": "To Do", "taskId": 29, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:00:14.179Z", "updatedAt": "2025-11-12T18:36:00.428Z", "description": null, "targetMetric": {"በመቶኛ": "70"}, "currentMetric": {}, "previousMetric": {"በመቶኛ": "10"}, "quarterlyGoals": {"q2": 45, "q4": 90}}	2025-11-12 21:36:00.428269+03
142	1	ACTIVITY_UPDATED	Activity	131	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 131, "title": "በከተሞች ለንብረት ግመታ የከተማ ቦታ ደረጃ መመሪያ እና የከተማ ቦታና ቤት ግብር ደንብ ማሻሻል ፣", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 29, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:59:04.584Z", "updatedAt": "2025-11-12T18:34:29.264Z", "description": null, "targetMetric": {"በሰነድ": "2"}, "currentMetric": {}, "previousMetric": {"በሰነድ": "1"}, "quarterlyGoals": {"q1": 1, "q2": 1}}	{"id": 131, "title": "በከተሞች ለንብረት ግመታ የከተማ ቦታ ደረጃ መመሪያ እና የከተማ ቦታና ቤት ግብር ደንብ ማሻሻል ፣", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 29, "weight": "0.1", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:59:04.584Z", "updatedAt": "2025-11-12T18:37:10.283Z", "description": null, "targetMetric": {"በሰነድ": "2"}, "currentMetric": {}, "previousMetric": {"በሰነድ": "1"}, "quarterlyGoals": {"q1": 1, "q2": 1}}	2025-11-12 21:37:10.283015+03
143	1	ACTIVITY_UPDATED	Activity	134	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 134, "title": "በክልሉ የሪል ፕሮፐርቲ ግብይት ግመታና ፈቃድ አሰጣጥ ስርዓት አደረጃጀት እንዲፈጠር ማድረግ (ፈቃድ በክልል ደረጃ እና በፌደራል ደረጃ ይሰጣል ስለዚህ በክልል እንዲሰጠጥ ማድረግ)", "isDone": false, "rollNo": 4, "status": "To Do", "taskId": 29, "weight": "0.166", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:00:42.446Z", "updatedAt": "2025-10-13T04:00:42.446Z", "description": null, "targetMetric": {"በቄጥር": "1"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 134, "title": "በክልሉ የሪል ፕሮፐርቲ ግብይት ግመታና ፈቃድ አሰጣጥ ስርዓት አደረጃጀት እንዲፈጠር ማድረግ (ፈቃድ በክልል ደረጃ እና በፌደራል ደረጃ ይሰጣል ስለዚህ በክልል እንዲሰጠጥ ማድረግ)", "isDone": false, "rollNo": 4, "status": "To Do", "taskId": 29, "weight": "0.166", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:00:42.446Z", "updatedAt": "2025-11-12T18:37:21.204Z", "description": null, "targetMetric": {"በቄጥር": "1"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {"q3": 1}}	2025-11-12 21:37:21.204444+03
243	1	GROUP_DELETED	Group	1	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 1, "name": "vskdlnvklsn vsndvjkndskjv", "createdAt": "2025-11-15T20:30:49.438Z", "updatedAt": "2025-11-15T20:31:15.012Z", "description": "ncakndvlknadkvl ksdmkvmsdkmsd", "profilePicture": "1763238675008_758332__1_.jpg"}	\N	2025-11-15 23:40:19.053668+03
145	1	ACTIVITY_UPDATED	Activity	136	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 136, "title": "የክልሉ መረጃ በሀገር ዓቀፍ ደረጃ በለማው የሪል ፕሮፐርቲ ፕላትፎርምና ኦብዘርቫቶሪ ሲስተም ላይ እንዲጫን ይደረጋል", "isDone": false, "rollNo": 6, "status": "To Do", "taskId": 29, "weight": "0.167", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:02:48.556Z", "updatedAt": "2025-10-13T04:02:48.556Z", "description": null, "targetMetric": {"በቄጥር": "1"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 136, "title": "የክልሉ መረጃ በሀገር ዓቀፍ ደረጃ በለማው የሪል ፕሮፐርቲ ፕላትፎርምና ኦብዘርቫቶሪ ሲስተም ላይ እንዲጫን ይደረጋል", "isDone": false, "rollNo": 6, "status": "To Do", "taskId": 29, "weight": "0.167", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:02:48.556Z", "updatedAt": "2025-11-12T18:37:49.079Z", "description": null, "targetMetric": {"በቄጥር": "1"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {"q4": 1}}	2025-11-12 21:37:49.079934+03
146	1	ACTIVITY_UPDATED	Activity	131	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 131, "title": "በከተሞች ለንብረት ግመታ የከተማ ቦታ ደረጃ መመሪያ እና የከተማ ቦታና ቤት ግብር ደንብ ማሻሻል ፣", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 29, "weight": "0.1", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:59:04.584Z", "updatedAt": "2025-11-12T18:37:10.283Z", "description": null, "targetMetric": {"በሰነድ": "2"}, "currentMetric": {}, "previousMetric": {"በሰነድ": "1"}, "quarterlyGoals": {"q1": 1, "q2": 1}}	{"id": 131, "title": "በከተሞች ለንብረት ግመታ የከተማ ቦታ ደረጃ መመሪያ እና የከተማ ቦታና ቤት ግብር ደንብ ማሻሻል ፣", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 29, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T03:59:04.584Z", "updatedAt": "2025-11-12T18:37:56.347Z", "description": null, "targetMetric": {"በሰነድ": "2"}, "currentMetric": {}, "previousMetric": {"በሰነድ": "1"}, "quarterlyGoals": {"q1": 1, "q2": 1}}	2025-11-12 21:37:56.347325+03
147	1	ACTIVITY_UPDATED	Activity	137	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 137, "title": "የተሰጠ የፕላን ስምምነት", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 30, "weight": "1", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:04:16.662Z", "updatedAt": "2025-10-13T04:04:16.662Z", "description": null, "targetMetric": {"በቁጥር": "1,600"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 137, "title": "የተሰጠ የፕላን ስምምነት", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 30, "weight": "1", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:04:16.662Z", "updatedAt": "2025-11-12T18:39:14.034Z", "description": null, "targetMetric": {"በቁጥር": "1600"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "591"}, "quarterlyGoals": {"q1": 320, "q2": 480, "q3": 480, "q4": 320}}	2025-11-12 21:39:14.034735+03
148	1	ACTIVITY_UPDATED	Activity	138	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 138, "title": "የተሰጠ አዲስ የግንባታ ፍቃድ", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 30, "weight": "1", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:05:19.504Z", "updatedAt": "2025-10-13T04:05:33.280Z", "description": null, "targetMetric": {"በቁጥር": "1,200"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 138, "title": "የተሰጠ አዲስ የግንባታ ፍቃድ", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 30, "weight": "1", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:05:19.504Z", "updatedAt": "2025-11-12T18:40:01.928Z", "description": null, "targetMetric": {"በቁጥር": "120"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "581"}, "quarterlyGoals": {"q1": 240, "q2": 360, "q3": 360, "q4": 240}}	2025-11-12 21:40:01.92881+03
149	1	ACTIVITY_UPDATED	Activity	138	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 138, "title": "የተሰጠ አዲስ የግንባታ ፍቃድ", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 30, "weight": "1", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:05:19.504Z", "updatedAt": "2025-11-12T18:40:01.928Z", "description": null, "targetMetric": {"በቁጥር": "120"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "581"}, "quarterlyGoals": {"q1": 240, "q2": 360, "q3": 360, "q4": 240}}	{"id": 138, "title": "የተሰጠ አዲስ የግንባታ ፍቃድ", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 30, "weight": "1", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:05:19.504Z", "updatedAt": "2025-11-12T18:40:10.881Z", "description": null, "targetMetric": {"በቁጥር": "1200"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "581"}, "quarterlyGoals": {"q1": 240, "q2": 360, "q3": 360, "q4": 240}}	2025-11-12 21:40:10.881976+03
150	1	ACTIVITY_UPDATED	Activity	139	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 139, "title": "የተሰጠ የግንባታ ፍቃድ ማሻሻያ ፍቃድ", "isDone": false, "rollNo": 3, "status": "To Do", "taskId": 30, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:05:55.502Z", "updatedAt": "2025-10-13T04:05:55.502Z", "description": null, "targetMetric": {"በቁጥር": "15"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 139, "title": "የተሰጠ የግንባታ ፍቃድ ማሻሻያ ፍቃድ", "isDone": false, "rollNo": 3, "status": "To Do", "taskId": 30, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:05:55.502Z", "updatedAt": "2025-11-12T18:40:44.348Z", "description": null, "targetMetric": {"በቁጥር": "15"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "8"}, "quarterlyGoals": {"q1": 3, "q2": 5, "q3": 4, "q4": 3}}	2025-11-12 21:40:44.34804+03
151	1	ACTIVITY_UPDATED	Activity	140	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 140, "title": "የተሰጠ የግንባታ ማራዘሚያ ፍቃድ", "isDone": false, "rollNo": 4, "status": "To Do", "taskId": 30, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:06:25.847Z", "updatedAt": "2025-10-13T04:06:25.847Z", "description": null, "targetMetric": {"በቁጥር": "30"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 140, "title": "የተሰጠ የግንባታ ማራዘሚያ ፍቃድ", "isDone": false, "rollNo": 4, "status": "To Do", "taskId": 30, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:06:25.847Z", "updatedAt": "2025-11-12T18:41:23.826Z", "description": null, "targetMetric": {"በቁጥር": "30"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "7"}, "quarterlyGoals": {"q1": 7, "q2": 8, "q3": 8, "q4": 7}}	2025-11-12 21:41:23.826922+03
152	1	ACTIVITY_UPDATED	Activity	141	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 141, "title": "የተሰጠ የግንባታ እድሳት ፍቃድ", "isDone": false, "rollNo": 5, "status": "To Do", "taskId": 30, "weight": "1", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:06:48.894Z", "updatedAt": "2025-10-13T04:06:48.894Z", "description": null, "targetMetric": {"በቁጥር": "355"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 141, "title": "የተሰጠ የግንባታ እድሳት ፍቃድ", "isDone": false, "rollNo": 5, "status": "To Do", "taskId": 30, "weight": "1", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:06:48.894Z", "updatedAt": "2025-11-12T18:41:50.844Z", "description": null, "targetMetric": {"በቁጥር": "355"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "95"}, "quarterlyGoals": {"q1": 70, "q2": 108, "q3": 107, "q4": 70}}	2025-11-12 21:41:50.844394+03
153	1	ACTIVITY_UPDATED	Activity	142	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 142, "title": "የተመዘገቡና ደረጃ የወጣላቸው የኮንስትራክሽን ፕሮጀክቶች", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 31, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:07:29.760Z", "updatedAt": "2025-10-13T04:07:29.760Z", "description": null, "targetMetric": {"በቁጥር": "80"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 142, "title": "የተመዘገቡና ደረጃ የወጣላቸው የኮንስትራክሽን ፕሮጀክቶች", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 31, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:07:29.760Z", "updatedAt": "2025-11-12T18:42:26.687Z", "description": null, "targetMetric": {"በቁጥር": "80"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "40"}, "quarterlyGoals": {"q1": 16, "q2": 24, "q3": 24, "q4": 16}}	2025-11-12 21:42:26.687394+03
154	1	ACTIVITY_UPDATED	Activity	143	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 143, "title": "ለሥራ ተቋራጩች፣ለአማካሪዎች፣ባለሙያዎች፣መሳሪያ አከራዮችና ግብአት አምራቾች የተደረገ ምዝገባ ፍቃድ", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 31, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:07:52.057Z", "updatedAt": "2025-10-13T04:07:52.057Z", "description": null, "targetMetric": {"በቁጥር": "100"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 143, "title": "ለሥራ ተቋራጩች፣ለአማካሪዎች፣ባለሙያዎች፣መሳሪያ አከራዮችና ግብአት አምራቾች የተደረገ ምዝገባ ፍቃድ", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 31, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:07:52.057Z", "updatedAt": "2025-11-12T18:42:49.020Z", "description": null, "targetMetric": {"በቁጥር": "100"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "52"}, "quarterlyGoals": {"q1": 20, "q2": 30, "q3": 30, "q4": 20}}	2025-11-12 21:42:49.02047+03
155	1	ACTIVITY_UPDATED	Activity	144	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 144, "title": "የወቅታዊ የግንበታ ገበያ ዋጋ ጥናት ማድረግ", "isDone": false, "rollNo": 3, "status": "To Do", "taskId": 31, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:08:13.817Z", "updatedAt": "2025-10-13T04:08:13.817Z", "description": null, "targetMetric": {"በሰነድ": "4"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 144, "title": "የወቅታዊ የግንበታ ገበያ ዋጋ ጥናት ማድረግ", "isDone": false, "rollNo": 3, "status": "To Do", "taskId": 31, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:08:13.817Z", "updatedAt": "2025-11-12T18:43:12.380Z", "description": null, "targetMetric": {"በሰነድ": "4"}, "currentMetric": {}, "previousMetric": {"በሰነድ": "3"}, "quarterlyGoals": {"q1": 1, "q2": 1, "q3": 1, "q4": 1}}	2025-11-12 21:43:12.380257+03
156	1	ACTIVITY_UPDATED	Activity	145	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 145, "title": "በክልሉ የነጠላ ግመታ መረጃ በማደራጀት (ለንብረት ዝውውር፤ ለካሳ እና ለባንክ እዳና እገዳ) አገልግሎት እንዲውል ማድረግ", "isDone": false, "rollNo": 4, "status": "To Do", "taskId": 31, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:08:32.255Z", "updatedAt": "2025-10-13T04:11:10.261Z", "description": null, "targetMetric": {"በሰነድ": "1"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 145, "title": "በክልሉ የነጠላ ግመታ መረጃ በማደራጀት (ለንብረት ዝውውር፤ ለካሳ እና ለባንክ እዳና እገዳ) አገልግሎት እንዲውል ማድረግ", "isDone": false, "rollNo": 4, "status": "To Do", "taskId": 31, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:08:32.255Z", "updatedAt": "2025-11-12T18:43:49.385Z", "description": null, "targetMetric": {"በሰነድ": "1"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {"q2": 1}}	2025-11-12 21:43:49.385496+03
157	1	ACTIVITY_UPDATED	Activity	146	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 146, "title": "4 የኮንስትራክሽን መሪ መዛኞችን በማፍራት 100 አነስተኛ እና መለስተኛ ባለሙያዎች ብቃታቸው በምዘና እንዲረጋገጥ ይደረጋል፡፡", "isDone": false, "rollNo": 5, "status": "To Do", "taskId": 31, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:09:02.473Z", "updatedAt": "2025-10-13T04:09:02.473Z", "description": null, "targetMetric": {"መሪ መዛኝ በቁጥር": "4"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 146, "title": "4 የኮንስትራክሽን መሪ መዛኞችን በማፍራት 100 አነስተኛ እና መለስተኛ ባለሙያዎች ብቃታቸው በምዘና እንዲረጋገጥ ይደረጋል፡፡", "isDone": false, "rollNo": 5, "status": "To Do", "taskId": 31, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:09:02.473Z", "updatedAt": "2025-11-12T18:44:05.687Z", "description": null, "targetMetric": {"መሪ መዛኝ በቁጥር": "4"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {"q2": 4}}	2025-11-12 21:44:05.687444+03
158	1	ACTIVITY_UPDATED	Activity	147	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 147, "title": "No Name/ስም የለም/Tihariho eiziina", "isDone": false, "rollNo": 6, "status": "To Do", "taskId": 31, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:12:07.105Z", "updatedAt": "2025-10-13T04:12:07.105Z", "description": null, "targetMetric": {"በምዘና የተረጋገጠ ባለሙያ በቁጥር": "100"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 147, "title": "No Name/ስም የለም/Tihariho eiziina", "isDone": false, "rollNo": 6, "status": "To Do", "taskId": 31, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:12:07.105Z", "updatedAt": "2025-11-12T18:44:39.083Z", "description": null, "targetMetric": {"በምዘና የተረጋገጠ ባለሙያ በቁጥር": "100"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {"q3": 50, "q4": 50}}	2025-11-12 21:44:39.083322+03
159	1	ACTIVITY_UPDATED	Activity	148	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 148, "title": "የህንፃ፣የመንገድ ዳር እና የውጭ ማስታወቂያ ፈቃድ መስጠት (አዲስ እና ነባር)", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 32, "weight": "1", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:13:03.160Z", "updatedAt": "2025-10-13T04:13:03.160Z", "description": null, "targetMetric": {"በቁጥር": "150"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 148, "title": "የህንፃ፣የመንገድ ዳር እና የውጭ ማስታወቂያ ፈቃድ መስጠት (አዲስ እና ነባር)", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 32, "weight": "1", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:13:03.160Z", "updatedAt": "2025-11-12T18:45:09.375Z", "description": null, "targetMetric": {"በቁጥር": "150"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "11"}, "quarterlyGoals": {"q1": 30, "q2": 45, "q3": 45, "q4": 30}}	2025-11-12 21:45:09.375966+03
160	1	ACTIVITY_UPDATED	Activity	149	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 149, "title": "የማስታወቂያ ተከላ ክትትልና ቁጥጥር ማድረግ", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 32, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:13:29.701Z", "updatedAt": "2025-10-13T04:13:29.701Z", "description": null, "targetMetric": {"በቁጥር": "150"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 149, "title": "የማስታወቂያ ተከላ ክትትልና ቁጥጥር ማድረግ", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 32, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:13:29.701Z", "updatedAt": "2025-11-12T18:45:28.016Z", "description": null, "targetMetric": {"በቁጥር": "150"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "104"}, "quarterlyGoals": {"q1": 30, "q2": 45, "q3": 45, "q4": 30}}	2025-11-12 21:45:28.016368+03
161	1	ACTIVITY_UPDATED	Activity	150	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 150, "title": "የተሰጠ የግንባታ እርከን ማሳወቂያ", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 33, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:17:08.442Z", "updatedAt": "2025-10-13T04:17:08.442Z", "description": null, "targetMetric": {"በቁጥር": "142"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 150, "title": "የተሰጠ የግንባታ እርከን ማሳወቂያ", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 33, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:17:08.442Z", "updatedAt": "2025-11-12T18:46:03.981Z", "description": null, "targetMetric": {"በቁጥር": "142"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "38"}, "quarterlyGoals": {"q1": 20, "q2": 30, "q3": 30, "q4": 20}}	2025-11-12 21:46:03.981541+03
162	1	ACTIVITY_UPDATED	Activity	151	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 151, "title": "የተሰጠ የግንባታ ግብአት ጥራት ማረጋገጫ ማስረጃ", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 33, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:17:37.083Z", "updatedAt": "2025-10-13T04:17:37.083Z", "description": null, "targetMetric": {"በቁጥር": "154"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 151, "title": "የተሰጠ የግንባታ ግብአት ጥራት ማረጋገጫ ማስረጃ", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 33, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:17:37.083Z", "updatedAt": "2025-11-12T18:46:26.365Z", "description": null, "targetMetric": {"በቁጥር": "154"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "50"}, "quarterlyGoals": {"q1": 31, "q2": 46, "q3": 46, "q4": 31}}	2025-11-12 21:46:26.365654+03
163	1	ACTIVITY_UPDATED	Activity	152	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 152, "title": "ተጀምረው ያልተጠናቀቁ እና አዲስ ግንባታ ፕሮጀክቶች ክትትልና ቁጥጥር ማድረግ", "isDone": false, "rollNo": 3, "status": "To Do", "taskId": 33, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:17:59.693Z", "updatedAt": "2025-10-13T04:17:59.693Z", "description": null, "targetMetric": {"በፕሮጀክት ቁጥር": "154"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 152, "title": "ተጀምረው ያልተጠናቀቁ እና አዲስ ግንባታ ፕሮጀክቶች ክትትልና ቁጥጥር ማድረግ", "isDone": false, "rollNo": 3, "status": "To Do", "taskId": 33, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:17:59.693Z", "updatedAt": "2025-11-12T18:46:56.879Z", "description": null, "targetMetric": {"በፕሮጀክት ቁጥር": "154"}, "currentMetric": {}, "previousMetric": {"በፕሮጀክት ቁጥር": "142"}, "quarterlyGoals": {"q1": 31, "q2": 46, "q3": 46, "q4": 31}}	2025-11-12 21:46:56.879469+03
164	1	ACTIVITY_UPDATED	Activity	153	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 153, "title": "የማስተካከያ ትዕዛዝ የተሰጠባቸዉና የተስተካከሉ ፕሮጀክቶች", "isDone": false, "rollNo": 4, "status": "To Do", "taskId": 33, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:18:24.412Z", "updatedAt": "2025-10-13T04:18:24.412Z", "description": null, "targetMetric": {"በቁጥር": "100"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 153, "title": "የማስተካከያ ትዕዛዝ የተሰጠባቸዉና የተስተካከሉ ፕሮጀክቶች", "isDone": false, "rollNo": 4, "status": "To Do", "taskId": 33, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:18:24.412Z", "updatedAt": "2025-11-12T18:47:20.079Z", "description": null, "targetMetric": {"በቁጥር": "100"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "38"}, "quarterlyGoals": {"q1": 20, "q2": 30, "q3": 30, "q4": 20}}	2025-11-12 21:47:20.079687+03
165	1	ACTIVITY_UPDATED	Activity	154	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 154, "title": "በከፊል ለተጠናቀቁ ህንጻዎች የተሰጠ መጠቀሚያ ፍቃድ", "isDone": false, "rollNo": 5, "status": "To Do", "taskId": 33, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:18:51.207Z", "updatedAt": "2025-10-13T04:18:51.207Z", "description": null, "targetMetric": {"በቁጥር": "30"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 154, "title": "በከፊል ለተጠናቀቁ ህንጻዎች የተሰጠ መጠቀሚያ ፍቃድ", "isDone": false, "rollNo": 5, "status": "To Do", "taskId": 33, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:18:51.207Z", "updatedAt": "2025-11-12T18:47:47.209Z", "description": null, "targetMetric": {"በቁጥር": "30"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "13"}, "quarterlyGoals": {"q1": 7, "q2": 8, "q3": 8, "q4": 7}}	2025-11-12 21:47:47.209506+03
166	1	ACTIVITY_UPDATED	Activity	155	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 155, "title": "ሙለ ለሙለ ለተጠናቀቁ ሕንፃዎች የተሰጠ መጠቀሚያ ፍቃድ የመንግስት አገልግሎት መስጫ ተቋማትን ጨምሮ", "isDone": false, "rollNo": 6, "status": "To Do", "taskId": 33, "weight": "1", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:19:15.995Z", "updatedAt": "2025-10-13T04:19:15.995Z", "description": null, "targetMetric": {"በቁጥር": "15"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 155, "title": "ሙለ ለሙለ ለተጠናቀቁ ሕንፃዎች የተሰጠ መጠቀሚያ ፍቃድ የመንግስት አገልግሎት መስጫ ተቋማትን ጨምሮ", "isDone": false, "rollNo": 6, "status": "To Do", "taskId": 33, "weight": "1", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:19:15.995Z", "updatedAt": "2025-11-12T18:48:08.080Z", "description": null, "targetMetric": {"በቁጥር": "15"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "6"}, "quarterlyGoals": {"q1": 3, "q2": 5, "q3": 4, "q4": 3}}	2025-11-12 21:48:08.080836+03
167	1	ACTIVITY_UPDATED	Activity	156	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 156, "title": "ክትትልና ቁጥጥር የተደረገባቸዉ ግንባታ ፕሮጀክቶች ሽፋን ማሳደግ", "isDone": false, "rollNo": 7, "status": "To Do", "taskId": 33, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:19:38.773Z", "updatedAt": "2025-10-13T04:19:38.773Z", "description": null, "targetMetric": {"በመቶኛ": "100"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 156, "title": "ክትትልና ቁጥጥር የተደረገባቸዉ ግንባታ ፕሮጀክቶች ሽፋን ማሳደግ", "isDone": false, "rollNo": 7, "status": "To Do", "taskId": 33, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:19:38.773Z", "updatedAt": "2025-11-12T18:48:33.587Z", "description": null, "targetMetric": {"በመቶኛ": "100"}, "currentMetric": {}, "previousMetric": {"በመቶኛ": "0"}, "quarterlyGoals": {"q1": 28, "q2": 43, "q3": 43, "q4": 28}}	2025-11-12 21:48:33.587047+03
168	1	ACTIVITY_UPDATED	Activity	157	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 157, "title": "ለቀረቡ የመረጃ ጥያቄዎች የተሰጡ ምላሾች", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 34, "weight": "0.75", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:20:31.695Z", "updatedAt": "2025-10-13T04:20:31.695Z", "description": null, "targetMetric": {"በመቶኛ": "100"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 157, "title": "ለቀረቡ የመረጃ ጥያቄዎች የተሰጡ ምላሾች", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 34, "weight": "0.75", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:20:31.695Z", "updatedAt": "2025-11-12T18:49:07.318Z", "description": null, "targetMetric": {"በመቶኛ": "100"}, "currentMetric": {}, "previousMetric": {"በመቶኛ": "70"}, "quarterlyGoals": {"q4": 100}}	2025-11-12 21:49:07.318105+03
169	1	ACTIVITY_UPDATED	Activity	158	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 158, "title": "ግንባታ ነክ መረጃ ማደራጀት", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 34, "weight": "0.75", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:20:57.091Z", "updatedAt": "2025-10-13T04:20:57.091Z", "description": null, "targetMetric": {"በሰነድ": "1"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 158, "title": "ግንባታ ነክ መረጃ ማደራጀት", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 34, "weight": "0.75", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:20:57.091Z", "updatedAt": "2025-11-12T18:49:23.992Z", "description": null, "targetMetric": {"በሰነድ": "1"}, "currentMetric": {}, "previousMetric": {"በሰነድ": "2"}, "quarterlyGoals": {"q4": 1}}	2025-11-12 21:49:23.992872+03
170	1	ACTIVITY_UPDATED	Activity	159	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 159, "title": "ዲጅታላይዝ የተደረገ የመረጃ ቋት", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 35, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:21:59.203Z", "updatedAt": "2025-10-13T04:21:59.203Z", "description": null, "targetMetric": {"በመቶኛ": "100"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 159, "title": "ዲጅታላይዝ የተደረገ የመረጃ ቋት", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 35, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:21:59.203Z", "updatedAt": "2025-11-12T18:50:07.870Z", "description": null, "targetMetric": {"በመቶኛ": "100"}, "currentMetric": {}, "previousMetric": {"በመቶኛ": "38"}, "quarterlyGoals": {"q4": 100}}	2025-11-12 21:50:07.870464+03
171	1	ACTIVITY_UPDATED	Activity	160	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 160, "title": "በኤላክትሮኒክስ ተደራሽ የሆነ አገልግሎት", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 35, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:22:23.714Z", "updatedAt": "2025-10-13T04:22:23.714Z", "description": null, "targetMetric": {"በመቶኛ": "50"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 160, "title": "በኤላክትሮኒክስ ተደራሽ የሆነ አገልግሎት", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 35, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:22:23.714Z", "updatedAt": "2025-11-12T18:50:25.180Z", "description": null, "targetMetric": {"በመቶኛ": "50"}, "currentMetric": {}, "previousMetric": {"በመቶኛ": "0"}, "quarterlyGoals": {"q2": 25, "q4": 25}}	2025-11-12 21:50:25.180837+03
172	1	ACTIVITY_UPDATED	Activity	161	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 161, "title": "ለመኖሪያ ቤት ግንባታ የሚሆን 10 ሄክታር የለማ መሬት እንዲዘጋጅ ማድረግ", "isDone": false, "rollNo": 1, "status": "In Progress", "taskId": 36, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:23:27.347Z", "updatedAt": "2025-10-14T14:22:26.448Z", "description": null, "targetMetric": {"በሄክታር": "10"}, "currentMetric": {"ahdg": "ukweh"}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 161, "title": "ለመኖሪያ ቤት ግንባታ የሚሆን 10 ሄክታር የለማ መሬት እንዲዘጋጅ ማድረግ", "isDone": false, "rollNo": 1, "status": "In Progress", "taskId": 36, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:23:27.347Z", "updatedAt": "2025-11-12T19:07:48.848Z", "description": null, "targetMetric": {"በሄክታር": "10"}, "currentMetric": {"ahdg": "ukweh"}, "previousMetric": {"በሄክታር": "0"}, "quarterlyGoals": {"q1": 6, "q2": 4}}	2025-11-12 22:07:48.848367+03
173	1	ACTIVITY_UPDATED	Activity	162	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 162, "title": "ለመኖሪያ ቤት ግንባታ የሚሆን የግንባታ ስምምነት ፍቃድ እንዲያገኙ ማድረግ", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 36, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:23:50.494Z", "updatedAt": "2025-10-13T04:23:50.494Z", "description": null, "targetMetric": {"በቁጥር": "12"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 162, "title": "ለመኖሪያ ቤት ግንባታ የሚሆን የግንባታ ስምምነት ፍቃድ እንዲያገኙ ማድረግ", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 36, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:23:50.494Z", "updatedAt": "2025-11-12T19:08:12.439Z", "description": null, "targetMetric": {"በቁጥር": "12"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "0"}, "quarterlyGoals": {"q1": 6, "q2": 4, "q3": 2}}	2025-11-12 22:08:12.439186+03
174	1	ACTIVITY_UPDATED	Activity	163	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 163, "title": "በገጠር የልማት ማዕከላት ደረጃቸውን ጠብቀው የተገነቡ ቤቶች", "isDone": false, "rollNo": 3, "status": "To Do", "taskId": 36, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:24:10.192Z", "updatedAt": "2025-10-13T04:24:10.192Z", "description": null, "targetMetric": {"በቁጥር": "90"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 163, "title": "በገጠር የልማት ማዕከላት ደረጃቸውን ጠብቀው የተገነቡ ቤቶች", "isDone": false, "rollNo": 3, "status": "To Do", "taskId": 36, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:24:10.192Z", "updatedAt": "2025-11-12T19:08:38.068Z", "description": null, "targetMetric": {"በቁጥር": "90"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "0"}, "quarterlyGoals": {"q2": 45, "q3": 45}}	2025-11-12 22:08:38.068322+03
175	1	ACTIVITY_UPDATED	Activity	164	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 164, "title": "በዘመናዊ መረጃ ስርዓት የመንግስት ቤት መረጃ መያዝ", "isDone": false, "rollNo": 4, "status": "To Do", "taskId": 36, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:24:37.532Z", "updatedAt": "2025-10-13T04:24:37.532Z", "description": null, "targetMetric": {"በቁጥር": "1,000"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 164, "title": "በዘመናዊ መረጃ ስርዓት የመንግስት ቤት መረጃ መያዝ", "isDone": false, "rollNo": 4, "status": "To Do", "taskId": 36, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:24:37.532Z", "updatedAt": "2025-11-12T19:09:24.805Z", "description": null, "targetMetric": {"በቁጥር": "1000"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "465"}, "quarterlyGoals": {"q1": 200, "q2": 300, "q3": 300, "q4": 200}}	2025-11-12 22:09:24.805497+03
176	1	ACTIVITY_UPDATED	Activity	165	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 165, "title": "በመንግስት አስተባባሪነት በኪራይ ወይም በባለቤትነት (ዝቅተኛ ገቢ ላላቸው ህብረተሰብ ክፍሎች/አፓርታማ) ቤቶች እንዲገነቡ ማድረግ", "isDone": false, "rollNo": 5, "status": "To Do", "taskId": 36, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:24:56.324Z", "updatedAt": "2025-10-13T04:25:14.602Z", "description": null, "targetMetric": {"በቁጥር": "200"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 165, "title": "በመንግስት አስተባባሪነት በኪራይ ወይም በባለቤትነት (ዝቅተኛ ገቢ ላላቸው ህብረተሰብ ክፍሎች/አፓርታማ) ቤቶች እንዲገነቡ ማድረግ", "isDone": false, "rollNo": 5, "status": "To Do", "taskId": 36, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:24:56.324Z", "updatedAt": "2025-11-12T19:09:53.716Z", "description": null, "targetMetric": {"በቁጥር": "200"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "0"}, "quarterlyGoals": {"q1": 40, "q2": 60, "q3": 60, "q4": 40}}	2025-11-12 22:09:53.716804+03
177	1	ACTIVITY_UPDATED	Activity	166	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 166, "title": "በመንግስት አስተባባሪነት ለሚገነቡ ቤቶች 50 ሚሊዮን ብር አንዲቀርብ ማድረግ", "isDone": false, "rollNo": 6, "status": "To Do", "taskId": 36, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:25:28.864Z", "updatedAt": "2025-10-13T04:26:04.476Z", "description": null, "targetMetric": {"በሚሊዮን ብር": "50"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 166, "title": "በመንግስት አስተባባሪነት ለሚገነቡ ቤቶች 50 ሚሊዮን ብር አንዲቀርብ ማድረግ", "isDone": false, "rollNo": 6, "status": "To Do", "taskId": 36, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:25:28.864Z", "updatedAt": "2025-11-12T19:10:40.506Z", "description": null, "targetMetric": {"በሚሊዮን ብር": "50"}, "currentMetric": {}, "previousMetric": {"በሚሊዮን ብር": ""}, "quarterlyGoals": {"q1": 40, "q2": 60, "q3": 60, "q4": 40}}	2025-11-12 22:10:40.506214+03
178	1	ACTIVITY_UPDATED	Activity	166	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 166, "title": "በመንግስት አስተባባሪነት ለሚገነቡ ቤቶች 50 ሚሊዮን ብር አንዲቀርብ ማድረግ", "isDone": false, "rollNo": 6, "status": "To Do", "taskId": 36, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:25:28.864Z", "updatedAt": "2025-11-12T19:10:40.506Z", "description": null, "targetMetric": {"በሚሊዮን ብር": "50"}, "currentMetric": {}, "previousMetric": {"በሚሊዮን ብር": ""}, "quarterlyGoals": {"q1": 40, "q2": 60, "q3": 60, "q4": 40}}	{"id": 166, "title": "በመንግስት አስተባባሪነት ለሚገነቡ ቤቶች 50 ሚሊዮን ብር አንዲቀርብ ማድረግ", "isDone": false, "rollNo": 6, "status": "To Do", "taskId": 36, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:25:28.864Z", "updatedAt": "2025-11-12T19:11:07.395Z", "description": null, "targetMetric": {"በሚሊዮን ብር": "50"}, "currentMetric": {}, "previousMetric": {"በሚሊዮን ብር": ""}, "quarterlyGoals": {"q1": 10, "q2": 15, "q3": 15, "q4": 10}}	2025-11-12 22:11:07.395593+03
179	1	ACTIVITY_UPDATED	Activity	167	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 167, "title": "በመንግስት አስተባባሪነት የተገነቡ ቤቶች እንዲተላለፉ ማድረግ", "isDone": false, "rollNo": 7, "status": "To Do", "taskId": 36, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:26:38.737Z", "updatedAt": "2025-10-13T04:28:19.331Z", "description": null, "targetMetric": {"none/ባዶ/busha": "6"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 167, "title": "በመንግስት አስተባባሪነት የተገነቡ ቤቶች እንዲተላለፉ ማድረግ", "isDone": false, "rollNo": 7, "status": "To Do", "taskId": 36, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:26:38.737Z", "updatedAt": "2025-11-12T19:12:08.558Z", "description": null, "targetMetric": {"none/ባዶ/busha": "6"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {"q2": 6}}	2025-11-12 22:12:08.558148+03
180	1	ACTIVITY_UPDATED	Activity	167	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 167, "title": "በመንግስት አስተባባሪነት የተገነቡ ቤቶች እንዲተላለፉ ማድረግ", "isDone": false, "rollNo": 7, "status": "To Do", "taskId": 36, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:26:38.737Z", "updatedAt": "2025-11-12T19:12:08.558Z", "description": null, "targetMetric": {"none/ባዶ/busha": "6"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {"q2": 6}}	{"id": 167, "title": "በመንግስት አስተባባሪነት የተገነቡ ቤቶች እንዲተላለፉ ማድረግ", "isDone": false, "rollNo": 7, "status": "To Do", "taskId": 36, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:26:38.737Z", "updatedAt": "2025-11-12T19:12:45.230Z", "description": null, "targetMetric": {"none/ባዶ/busha": "6"}, "currentMetric": {}, "previousMetric": {"none/ባዶ/busha": "0"}, "quarterlyGoals": {"q2": 6}}	2025-11-12 22:12:45.230906+03
181	1	ACTIVITY_UPDATED	Activity	168	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 168, "title": "ከ100/0 ቤቶች ቀሪ ክፍያ የሚሰበሰብ ገቢ (በግሉ ዘርፍ ለሚገነቡ ቤቶች አንዲቀርብ ማድረግ)", "isDone": false, "rollNo": 8, "status": "To Do", "taskId": 36, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:28:48.291Z", "updatedAt": "2025-10-13T04:28:48.291Z", "description": null, "targetMetric": {"በብር": "20,000,000"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 168, "title": "ከ100/0 ቤቶች ቀሪ ክፍያ የሚሰበሰብ ገቢ (በግሉ ዘርፍ ለሚገነቡ ቤቶች አንዲቀርብ ማድረግ)", "isDone": false, "rollNo": 8, "status": "To Do", "taskId": 36, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T04:28:48.291Z", "updatedAt": "2025-11-12T19:14:27.627Z", "description": null, "targetMetric": {"በብር": "20000000"}, "currentMetric": {}, "previousMetric": {"በብር": "20393867"}, "quarterlyGoals": {"q1": 4000000, "q2": 6000000, "q3": 6000000, "q4": 4000000}}	2025-11-12 22:14:27.627684+03
182	1	ACTIVITY_UPDATED	Activity	169	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 169, "title": "ከመምህራን ቤት ወርሃዊ ክፍያ የሚሰበሰበ ገቢ", "isDone": false, "rollNo": 9, "status": "To Do", "taskId": 36, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T05:47:49.899Z", "updatedAt": "2025-10-13T05:47:49.899Z", "description": null, "targetMetric": {"በብር": "1,750,000"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 169, "title": "ከመምህራን ቤት ወርሃዊ ክፍያ የሚሰበሰበ ገቢ", "isDone": false, "rollNo": 9, "status": "To Do", "taskId": 36, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T05:47:49.899Z", "updatedAt": "2025-11-12T19:17:01.497Z", "description": null, "targetMetric": {"በብር": "1750000"}, "currentMetric": {}, "previousMetric": {"በብር": "1750000"}, "quarterlyGoals": {"q1": 437500, "q2": 437500, "q3": 437500, "q4": 40}}	2025-11-12 22:17:01.497367+03
183	1	ACTIVITY_UPDATED	Activity	171	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 171, "title": "በመኖሪያ ቤት ህብረት ሥራ ማኀበራት የቤት ልማት አቅርቦት ፕሮግራም ቤቶች እንዲገነቡ ማድረግ", "isDone": false, "rollNo": 11, "status": "To Do", "taskId": 36, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T05:51:44.475Z", "updatedAt": "2025-10-13T05:51:44.475Z", "description": null, "targetMetric": {"በቁጥር": "120"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 171, "title": "በመኖሪያ ቤት ህብረት ሥራ ማኀበራት የቤት ልማት አቅርቦት ፕሮግራም ቤቶች እንዲገነቡ ማድረግ", "isDone": false, "rollNo": 11, "status": "To Do", "taskId": 36, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T05:51:44.475Z", "updatedAt": "2025-11-12T19:19:07.100Z", "description": null, "targetMetric": {"በቁጥር": "120"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "0"}, "quarterlyGoals": {"q2": 24, "q3": 56, "q4": 40}}	2025-11-12 22:19:07.10027+03
184	1	ACTIVITY_UPDATED	Activity	170	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 170, "title": "የአፓርታማ ቤት ግንባታ የሚሰበሰብ ገንዘብ", "isDone": false, "rollNo": 10, "status": "To Do", "taskId": 36, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T05:49:14.157Z", "updatedAt": "2025-10-13T05:49:14.157Z", "description": null, "targetMetric": {"በብር": "30,000,000"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 170, "title": "የአፓርታማ ቤት ግንባታ የሚሰበሰብ ገንዘብ", "isDone": false, "rollNo": 10, "status": "To Do", "taskId": 36, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T05:49:14.157Z", "updatedAt": "2025-11-12T19:20:04.386Z", "description": null, "targetMetric": {"በብር": "30000000"}, "currentMetric": {}, "previousMetric": {"በብር": "0"}, "quarterlyGoals": {"q1": 6000000, "q2": 9000000, "q3": 9000000, "q4": 4000000}}	2025-11-12 22:20:04.386946+03
185	1	ACTIVITY_UPDATED	Activity	172	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 172, "title": "በግለሰቦች የቤት ልማት አቅርቦት ፕሮግራም ቤቶች እንዲገነቡ ማድረግ", "isDone": false, "rollNo": 12, "status": "To Do", "taskId": 36, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T05:52:13.800Z", "updatedAt": "2025-10-13T05:52:13.800Z", "description": null, "targetMetric": {"በቁጥር": "1,200"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 172, "title": "በግለሰቦች የቤት ልማት አቅርቦት ፕሮግራም ቤቶች እንዲገነቡ ማድረግ", "isDone": false, "rollNo": 12, "status": "To Do", "taskId": 36, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T05:52:13.800Z", "updatedAt": "2025-11-12T19:20:47.352Z", "description": null, "targetMetric": {"በቁጥር": "1200"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "498"}, "quarterlyGoals": {"q1": 240, "q2": 360, "q3": 360, "q4": 240}}	2025-11-12 22:20:47.352539+03
186	1	ACTIVITY_UPDATED	Activity	173	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 173, "title": "በሪል ስቴት የቤት ልማት አቅርቦት ፕሮግራም 50 ቤቶች መገንባት", "isDone": false, "rollNo": 13, "status": "To Do", "taskId": 36, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T05:52:42.965Z", "updatedAt": "2025-10-13T05:52:42.965Z", "description": null, "targetMetric": {"በቁጥር": "50"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 173, "title": "በሪል ስቴት የቤት ልማት አቅርቦት ፕሮግራም 50 ቤቶች መገንባት", "isDone": false, "rollNo": 13, "status": "To Do", "taskId": 36, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T05:52:42.965Z", "updatedAt": "2025-11-12T19:21:20.350Z", "description": null, "targetMetric": {"በቁጥር": "50"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "0"}, "quarterlyGoals": {"q1": 10, "q2": 15, "q3": 15, "q4": 10}}	2025-11-12 22:21:20.350313+03
187	1	ACTIVITY_UPDATED	Activity	174	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 174, "title": "በባለሀብቶች ቅይጥ ህንፃ የሚገነቡ ቤቶች (መረጃ ከከተማ ልማት የሚሰበሰብ)", "isDone": false, "rollNo": 14, "status": "To Do", "taskId": 36, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T05:53:08.656Z", "updatedAt": "2025-10-13T05:53:25.121Z", "description": null, "targetMetric": {"በቁጥር": "50"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 174, "title": "በባለሀብቶች ቅይጥ ህንፃ የሚገነቡ ቤቶች (መረጃ ከከተማ ልማት የሚሰበሰብ)", "isDone": false, "rollNo": 14, "status": "To Do", "taskId": 36, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T05:53:08.656Z", "updatedAt": "2025-11-12T19:21:47.273Z", "description": null, "targetMetric": {"በቁጥር": "50"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "0"}, "quarterlyGoals": {"q1": 10, "q2": 15, "q3": 15, "q4": 10}}	2025-11-12 22:21:47.273949+03
188	1	ACTIVITY_UPDATED	Activity	175	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 175, "title": "በመልሶ ማልማት ቤቶች እንዲገነቡ ማድረግ", "isDone": false, "rollNo": 15, "status": "To Do", "taskId": 36, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T05:53:51.340Z", "updatedAt": "2025-10-13T05:53:51.340Z", "description": null, "targetMetric": {"በቁጥር": "230"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 175, "title": "በመልሶ ማልማት ቤቶች እንዲገነቡ ማድረግ", "isDone": false, "rollNo": 15, "status": "To Do", "taskId": 36, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T05:53:51.340Z", "updatedAt": "2025-11-12T19:22:22.416Z", "description": null, "targetMetric": {"በቁጥር": "230"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "0"}, "quarterlyGoals": {"q1": 46, "q2": 50, "q3": 80, "q4": 54}}	2025-11-12 22:22:22.416941+03
189	1	ACTIVITY_UPDATED	Activity	176	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 176, "title": "በማሻሻያ (በእድሳት) ልማት ደረጃቸው እንዲሻሻል ማድረግ", "isDone": false, "rollNo": 16, "status": "To Do", "taskId": 36, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T05:54:21.699Z", "updatedAt": "2025-10-13T05:54:21.699Z", "description": null, "targetMetric": {"በቁጥር": "300"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 176, "title": "በማሻሻያ (በእድሳት) ልማት ደረጃቸው እንዲሻሻል ማድረግ", "isDone": false, "rollNo": 16, "status": "To Do", "taskId": 36, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T05:54:21.699Z", "updatedAt": "2025-11-12T19:22:47.298Z", "description": null, "targetMetric": {"በቁጥር": "300"}, "currentMetric": {}, "previousMetric": {"በቁጥር": ""}, "quarterlyGoals": {"q1": 250, "q4": 50}}	2025-11-12 22:22:47.298696+03
190	1	ACTIVITY_UPDATED	Activity	177	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 177, "title": "የፕሮጀክት ሙሉ ዲዛይኖች ማዘጋጀት", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 37, "weight": "1", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T05:55:31.814Z", "updatedAt": "2025-10-13T05:55:31.814Z", "description": null, "targetMetric": {"በቁጥር": "12"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 177, "title": "የፕሮጀክት ሙሉ ዲዛይኖች ማዘጋጀት", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 37, "weight": "1", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T05:55:31.814Z", "updatedAt": "2025-11-12T19:23:16.077Z", "description": null, "targetMetric": {"በቁጥር": "12"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "8"}, "quarterlyGoals": {"q1": 6, "q2": 6}}	2025-11-12 22:23:16.077848+03
191	1	ACTIVITY_UPDATED	Activity	178	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 178, "title": "የፕሮጀክት BOQ እና ነጠላ ዋጋ ግምት ማዘጋጃት", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 37, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T05:55:56.179Z", "updatedAt": "2025-10-13T05:55:56.179Z", "description": null, "targetMetric": {"በቁጥር": "10"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 178, "title": "የፕሮጀክት BOQ እና ነጠላ ዋጋ ግምት ማዘጋጃት", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 37, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T05:55:56.179Z", "updatedAt": "2025-11-12T19:23:38.563Z", "description": null, "targetMetric": {"በቁጥር": "10"}, "currentMetric": {}, "previousMetric": {"በቁጥር": ""}, "quarterlyGoals": {"q1": 2, "q2": 3, "q3": 3, "q4": 2}}	2025-11-12 22:23:38.56312+03
192	1	ACTIVITY_UPDATED	Activity	179	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 179, "title": "ባለቤት መስሪያ ቤቶች የፕሮጀክቶቻቸውን ዲዛይን እንዲያጸድቁ ተዘጋጅቶ የተላከላቸው የፕሮጀክታቸው ዲዛይኖች", "isDone": false, "rollNo": 3, "status": "To Do", "taskId": 37, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T05:56:31.381Z", "updatedAt": "2025-10-13T05:56:31.381Z", "description": null, "targetMetric": {"በቁጥር": "9"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 179, "title": "ባለቤት መስሪያ ቤቶች የፕሮጀክቶቻቸውን ዲዛይን እንዲያጸድቁ ተዘጋጅቶ የተላከላቸው የፕሮጀክታቸው ዲዛይኖች", "isDone": false, "rollNo": 3, "status": "To Do", "taskId": 37, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T05:56:31.381Z", "updatedAt": "2025-11-12T19:25:14.794Z", "description": null, "targetMetric": {"በቁጥር": "9"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "5"}, "quarterlyGoals": {"q1": 6, "q2": 3}}	2025-11-12 22:25:14.794716+03
193	1	ACTIVITY_UPDATED	Activity	180	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 180, "title": "ለመኖ/ህ/ስ/ማህበራት እና ለገጠር ቤቶች ልማት   ስታንዳርድ ዲዛይኖች ማዘጋጀት", "isDone": false, "rollNo": 4, "status": "To Do", "taskId": 37, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T05:57:05.386Z", "updatedAt": "2025-10-13T05:57:05.386Z", "description": null, "targetMetric": {"ለከተማ በማህበራት የተዘጋጀ ዲዛይን በቁጥር": "1"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 180, "title": "ለመኖ/ህ/ስ/ማህበራት እና ለገጠር ቤቶች ልማት   ስታንዳርድ ዲዛይኖች ማዘጋጀት", "isDone": false, "rollNo": 4, "status": "To Do", "taskId": 37, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T05:57:05.386Z", "updatedAt": "2025-11-12T19:26:19.789Z", "description": null, "targetMetric": {"ለከተማ በማህበራት የተዘጋጀ ዲዛይን በቁጥር": "1"}, "currentMetric": {}, "previousMetric": {"ለከተማ በማህበራት የተዘጋጀ ዲዛይን በቁጥር": "0"}, "quarterlyGoals": {"q2": 1}}	2025-11-12 22:26:19.789977+03
194	1	ACTIVITY_UPDATED	Activity	181	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 181, "title": "ለመኖ/ህ/ስ/ማህበራት እና ለገጠር ቤቶች ልማት   ስታንዳርድ ዲዛይኖች ማዘጋጀት", "isDone": false, "rollNo": 5, "status": "To Do", "taskId": 37, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T05:58:00.969Z", "updatedAt": "2025-10-13T05:58:00.969Z", "description": null, "targetMetric": {"ለገጠር ቤቶች የተዘጋጀ ዲዛይን በቁጥር": "1"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 181, "title": "ለመኖ/ህ/ስ/ማህበራት እና ለገጠር ቤቶች ልማት   ስታንዳርድ ዲዛይኖች ማዘጋጀት", "isDone": false, "rollNo": 5, "status": "To Do", "taskId": 37, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T05:58:00.969Z", "updatedAt": "2025-11-12T19:26:59.690Z", "description": null, "targetMetric": {"ለገጠር ቤቶች የተዘጋጀ ዲዛይን በቁጥር": "1"}, "currentMetric": {}, "previousMetric": {"ለገጠር ቤቶች የተዘጋጀ ዲዛይን በቁጥር": "0"}, "quarterlyGoals": {"q2": 1}}	2025-11-12 22:26:59.690669+03
195	1	ACTIVITY_UPDATED	Activity	182	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 182, "title": "የተጠናቀቀ የጨረታ ሒደት", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 38, "weight": "1", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T05:59:59.882Z", "updatedAt": "2025-10-13T05:59:59.882Z", "description": null, "targetMetric": {"በቁጥር": "9"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 182, "title": "የተጠናቀቀ የጨረታ ሒደት", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 38, "weight": "1", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T05:59:59.882Z", "updatedAt": "2025-11-12T19:27:34.757Z", "description": null, "targetMetric": {"በቁጥር": "9"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "7"}, "quarterlyGoals": {"q1": 4, "q2": 5}}	2025-11-12 22:27:34.757331+03
196	1	ACTIVITY_UPDATED	Activity	183	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 183, "title": "በጨረታ ሰነድ መሰረት የሚታሰሩ ውሎች", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 38, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T06:00:32.909Z", "updatedAt": "2025-10-13T06:00:32.909Z", "description": null, "targetMetric": {"በቁጥር": "9"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 183, "title": "በጨረታ ሰነድ መሰረት የሚታሰሩ ውሎች", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 38, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T06:00:32.909Z", "updatedAt": "2025-11-12T19:27:52.606Z", "description": null, "targetMetric": {"በቁጥር": "9"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "7"}, "quarterlyGoals": {"q1": 9}}	2025-11-12 22:27:52.606991+03
197	1	ACTIVITY_CREATED	Activity	205	{"title": "የተዘጋጀ የጨረታ ሰነድ", "rollNo": 17, "taskId": 38}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	\N	\N	2025-11-12 22:31:17.164147+03
198	1	ACTIVITY_UPDATED	Activity	182	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 182, "title": "የተጠናቀቀ የጨረታ ሒደት", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 38, "weight": "1", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T05:59:59.882Z", "updatedAt": "2025-11-12T19:27:34.757Z", "description": null, "targetMetric": {"በቁጥር": "9"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "7"}, "quarterlyGoals": {"q1": 4, "q2": 5}}	{"id": 182, "title": "የተጠናቀቀ የጨረታ ሒደት", "isDone": false, "rollNo": 11, "status": "To Do", "taskId": 38, "weight": "1", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T05:59:59.882Z", "updatedAt": "2025-11-12T19:35:59.342Z", "description": null, "targetMetric": {"በቁጥር": "9"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "7"}, "quarterlyGoals": {"q1": 4, "q2": 5}}	2025-11-12 22:35:59.342512+03
199	1	ACTIVITY_UPDATED	Activity	205	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 205, "title": "የተዘጋጀ የጨረታ ሰነድ", "isDone": false, "rollNo": 17, "status": "To Do", "taskId": 38, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-11-12T19:31:17.164Z", "updatedAt": "2025-11-12T19:31:17.164Z", "description": null, "targetMetric": {"በቁጥር": "9"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "7"}, "quarterlyGoals": {"q1": 4, "q2": 5}}	{"id": 205, "title": "የተዘጋጀ የጨረታ ሰነድ", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 38, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-11-12T19:31:17.164Z", "updatedAt": "2025-11-12T19:36:07.653Z", "description": null, "targetMetric": {"በቁጥር": "9"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "7"}, "quarterlyGoals": {"q1": 4, "q2": 5}}	2025-11-12 22:36:07.653209+03
200	1	ACTIVITY_DELETED	Activity	186	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 186, "title": "በተያዘላቸዉ ጊዜ፣ በጀትና ጥራት የሚጠናቀቁ ፕሮጀክቶች ብዛት", "isDone": false, "rollNo": 5, "status": "To Do", "taskId": 38, "weight": "1", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T06:04:14.507Z", "updatedAt": "2025-10-13T06:04:14.507Z", "description": null, "targetMetric": {"በቁጥር": "12"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	\N	2025-11-12 22:36:36.146104+03
201	1	ACTIVITY_UPDATED	Activity	185	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 185, "title": "በተያዘላቸዉ ጊዜ፣ በጀትና ጥራት የሚጠናቀቁ ፕሮጀክቶች ብዛት", "isDone": false, "rollNo": 4, "status": "To Do", "taskId": 38, "weight": "1", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T06:01:58.046Z", "updatedAt": "2025-10-13T06:01:58.046Z", "description": null, "targetMetric": {"በቁጥር": "12"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 185, "title": "በተያዘላቸዉ ጊዜ፣ በጀትና ጥራት የሚጠናቀቁ ፕሮጀክቶች ብዛት", "isDone": false, "rollNo": 5, "status": "To Do", "taskId": 38, "weight": "1", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T06:01:58.046Z", "updatedAt": "2025-11-12T19:37:05.923Z", "description": null, "targetMetric": {"በቁጥር": "12"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	2025-11-12 22:37:05.923299+03
202	1	ACTIVITY_UPDATED	Activity	184	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 184, "title": "ክትትልና ቁጥጥር የሚደረግባቸው ፕሮጀክቶች", "isDone": false, "rollNo": 3, "status": "To Do", "taskId": 38, "weight": "1", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T06:01:05.706Z", "updatedAt": "2025-10-13T06:01:05.706Z", "description": null, "targetMetric": {"በቁጥር": "22"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 184, "title": "ክትትልና ቁጥጥር የሚደረግባቸው ፕሮጀክቶች", "isDone": false, "rollNo": 4, "status": "To Do", "taskId": 38, "weight": "1", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T06:01:05.706Z", "updatedAt": "2025-11-12T19:37:15.926Z", "description": null, "targetMetric": {"በቁጥር": "22"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	2025-11-12 22:37:15.926339+03
203	1	ACTIVITY_UPDATED	Activity	183	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 183, "title": "በጨረታ ሰነድ መሰረት የሚታሰሩ ውሎች", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 38, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T06:00:32.909Z", "updatedAt": "2025-11-12T19:27:52.606Z", "description": null, "targetMetric": {"በቁጥር": "9"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "7"}, "quarterlyGoals": {"q1": 9}}	{"id": 183, "title": "በጨረታ ሰነድ መሰረት የሚታሰሩ ውሎች", "isDone": false, "rollNo": 3, "status": "To Do", "taskId": 38, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T06:00:32.909Z", "updatedAt": "2025-11-12T19:37:29.751Z", "description": null, "targetMetric": {"በቁጥር": "9"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "7"}, "quarterlyGoals": {"q1": 9}}	2025-11-12 22:37:29.751103+03
204	1	ACTIVITY_UPDATED	Activity	182	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 182, "title": "የተጠናቀቀ የጨረታ ሒደት", "isDone": false, "rollNo": 11, "status": "To Do", "taskId": 38, "weight": "1", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T05:59:59.882Z", "updatedAt": "2025-11-12T19:35:59.342Z", "description": null, "targetMetric": {"በቁጥር": "9"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "7"}, "quarterlyGoals": {"q1": 4, "q2": 5}}	{"id": 182, "title": "የተጠናቀቀ የጨረታ ሒደት", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 38, "weight": "1", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-13T05:59:59.882Z", "updatedAt": "2025-11-12T19:37:38.418Z", "description": null, "targetMetric": {"በቁጥር": "9"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "7"}, "quarterlyGoals": {"q1": 4, "q2": 5}}	2025-11-12 22:37:38.418971+03
205	1	ACTIVITY_CREATED	Activity	206	{"title": "በፕሮጀክቶች ግንባታ ቋሚና የሥራ ዕድል የሚፈጠርላቸው ሰዎች", "rollNo": 18, "taskId": 38}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	\N	\N	2025-11-12 22:39:14.307113+03
206	1	ACTIVITY_CREATED	Activity	207	{"title": "በቤቶች ልማትና በመንግስት ኮንስትራክሽን ዙሪያ የሚደረጉ ጥናቶች", "rollNo": 19, "taskId": 38}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	\N	\N	2025-11-12 22:40:08.489276+03
207	1	ACTIVITY_CREATED	Activity	208	{"title": "በተያዘላቸዉ ጊዜ፣ በጀትና ጥራት የተጠናቀቁ ፕሮጀክቶች ሽፋን ማሳደግ", "rollNo": 20, "taskId": 38}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	\N	\N	2025-11-12 22:40:48.767483+03
208	1	TASK_CREATED	Task	41	{"title": "የክልሉን የኮንስትራክሽን ጥራት ምርመራ አገልግሎት በማሳደግ", "goalId": 11, "rollNo": 10, "assigneeId": null}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	\N	\N	2025-11-12 22:41:26.760682+03
209	1	TASK_UPDATED	Task	41	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 41, "title": "የክልሉን የኮንስትራክሽን ጥራት ምርመራ አገልግሎት በማሳደግ", "goalId": 11, "rollNo": 10, "status": "To Do", "weight": "2", "dueDate": null, "progress": 0, "createdAt": "2025-11-12T19:41:26.760Z", "updatedAt": "2025-11-12T19:41:26.760Z", "assigneeId": null, "description": null}	{"id": 41, "title": "የክልሉን የኮንስትራክሽን ጥራት ምርመራ አገልግሎት በማሳደግ", "goalId": 11, "rollNo": 4, "status": "To Do", "weight": "2", "dueDate": null, "progress": 0, "createdAt": "2025-11-12T19:41:26.760Z", "updatedAt": "2025-11-12T19:41:35.858Z", "assigneeId": null, "description": null}	2025-11-12 22:41:35.858875+03
210	1	ACTIVITY_CREATED	Activity	209	{"title": "የኮንስትራክሽን የላቦራቶሪ አገልግሎት መስጠት", "rollNo": 21, "taskId": 41}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	\N	\N	2025-11-12 22:42:31.444152+03
211	1	ACTIVITY_CREATED	Activity	210	{"title": "ከተሰጡ የኮንስትራክሽን የላቦራቶሪ አገልግሎቶችን የተገኘ ገቢ", "rollNo": 22, "taskId": 41}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	\N	\N	2025-11-12 22:47:38.659512+03
212	1	ACTIVITY_UPDATED	Activity	188	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 188, "title": "በመኖሪያ ቤቶች ቆጠራ (Inventory) ወቅት የተገኙ ግኝቶችን መፍትሄ መስጠት", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 39, "weight": "1", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-27T03:55:45.246Z", "updatedAt": "2025-10-27T03:56:04.533Z", "description": null, "targetMetric": {"በቁጥር": "3"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "3"}, "quarterlyGoals": {}}	{"id": 188, "title": "በመኖሪያ ቤቶች ቆጠራ (Inventory) ወቅት የተገኙ ግኝቶችን መፍትሄ መስጠት", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 39, "weight": "1", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-27T03:55:45.246Z", "updatedAt": "2025-11-12T19:48:47.005Z", "description": null, "targetMetric": {"በቁጥር": "3"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "3"}, "quarterlyGoals": {"q1": 2, "q2": 1}}	2025-11-12 22:48:47.005092+03
213	1	ACTIVITY_UPDATED	Activity	189	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 189, "title": "ኤጀንሲው የሚያስተዳድራቸውን ኮንዶምኒየም ቤቶች አመታዊ ቆጠራ ማድረግ", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 39, "weight": "0.75", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-27T03:56:46.976Z", "updatedAt": "2025-10-27T03:56:55.226Z", "description": null, "targetMetric": {"በቁጥር": "166"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 189, "title": "ኤጀንሲው የሚያስተዳድራቸውን ኮንዶምኒየም ቤቶች አመታዊ ቆጠራ ማድረግ", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 39, "weight": "0.75", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-27T03:56:46.976Z", "updatedAt": "2025-11-12T19:49:24.422Z", "description": null, "targetMetric": {"በቁጥር": "166"}, "currentMetric": {}, "previousMetric": {"በቁጥር": ""}, "quarterlyGoals": {"q1": 66, "q2": 100}}	2025-11-12 22:49:24.422975+03
214	1	ACTIVITY_UPDATED	Activity	190	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 190, "title": "ኤጀንሲው የሚያስተዳድራቸውን ንግድ ቤቶች አመታዊ ቆጠራ ማድረግ", "isDone": false, "rollNo": 3, "status": "To Do", "taskId": 39, "weight": "0.75", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-27T03:57:33.526Z", "updatedAt": "2025-10-27T03:57:40.645Z", "description": null, "targetMetric": {"በቁጥር": "343"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 190, "title": "ኤጀንሲው የሚያስተዳድራቸውን ንግድ ቤቶች አመታዊ ቆጠራ ማድረግ", "isDone": false, "rollNo": 3, "status": "To Do", "taskId": 39, "weight": "0.75", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-27T03:57:33.526Z", "updatedAt": "2025-11-12T19:50:03.504Z", "description": null, "targetMetric": {"በቁጥር": "343"}, "currentMetric": {}, "previousMetric": {"በቁጥር": ""}, "quarterlyGoals": {"q2": 280, "q3": 63}}	2025-11-12 22:50:03.504639+03
215	1	ACTIVITY_UPDATED	Activity	191	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 191, "title": "መኖሪያ ቤቶች፣ መንግስታዊና መንግታዊ ያልሆኑ ተቋም ኪራይ ተመን ማሻሻያ ጥናት አስወስኖ ወደ ትግበራ መግባት", "isDone": false, "rollNo": 4, "status": "To Do", "taskId": 39, "weight": "0.75", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-27T03:58:12.354Z", "updatedAt": "2025-10-27T03:58:12.354Z", "description": null, "targetMetric": {"በሰነድ": "2"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 191, "title": "መኖሪያ ቤቶች፣ መንግስታዊና መንግታዊ ያልሆኑ ተቋም ኪራይ ተመን ማሻሻያ ጥናት አስወስኖ ወደ ትግበራ መግባት", "isDone": false, "rollNo": 4, "status": "To Do", "taskId": 39, "weight": "0.75", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-27T03:58:12.354Z", "updatedAt": "2025-11-12T19:51:02.763Z", "description": null, "targetMetric": {"በሰነድ": "2"}, "currentMetric": {}, "previousMetric": {"በሰነድ": ""}, "quarterlyGoals": {"q1": 1, "q2": 1}}	2025-11-12 22:51:02.763251+03
216	1	ACTIVITY_UPDATED	Activity	192	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 192, "title": "ነባር መመሪያን አሻሽሎ ለቦርድ በማቅረብ ማስወሰን", "isDone": false, "rollNo": 5, "status": "To Do", "taskId": 39, "weight": "0.75", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-27T03:58:40.763Z", "updatedAt": "2025-10-27T03:58:51.379Z", "description": null, "targetMetric": {"በሰነድ": "1"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 192, "title": "ነባር መመሪያን አሻሽሎ ለቦርድ በማቅረብ ማስወሰን", "isDone": false, "rollNo": 5, "status": "To Do", "taskId": 39, "weight": "0.75", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-27T03:58:40.763Z", "updatedAt": "2025-11-12T19:51:51.799Z", "description": null, "targetMetric": {"በሰነድ": "1"}, "currentMetric": {}, "previousMetric": {"በሰነድ": ""}, "quarterlyGoals": {"q1": 1}}	2025-11-12 22:51:51.799827+03
217	1	ACTIVITY_UPDATED	Activity	193	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 193, "title": "ተከራይ ደንበኛ አዲስ የተሻሻለውን ውል እንዲሞሉ ማድረግ", "isDone": false, "rollNo": 6, "status": "To Do", "taskId": 39, "weight": "0.75", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-27T03:59:41.593Z", "updatedAt": "2025-10-27T03:59:41.593Z", "description": null, "targetMetric": {"በቁጥር": "1283"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 193, "title": "ተከራይ ደንበኛ አዲስ የተሻሻለውን ውል እንዲሞሉ ማድረግ", "isDone": false, "rollNo": 6, "status": "To Do", "taskId": 39, "weight": "0.75", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-27T03:59:41.593Z", "updatedAt": "2025-11-12T19:53:05.742Z", "description": null, "targetMetric": {"በቁጥር": "1283"}, "currentMetric": {}, "previousMetric": {"በቁጥር": ""}, "quarterlyGoals": {"q1": 1000, "q2": 283}}	2025-11-12 22:53:05.742435+03
218	1	ACTIVITY_UPDATED	Activity	194	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 194, "title": "በይዞታዎቻችን ላይ ሊፈጸሙ የሚችሉትን ህገ-ወጥ ድርጊቶችን ክትትል ማድረግ", "isDone": false, "rollNo": 7, "status": "To Do", "taskId": 39, "weight": "0.75", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-27T04:00:13.078Z", "updatedAt": "2025-10-27T04:00:45.596Z", "description": null, "targetMetric": {"በወር": "12"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 194, "title": "በይዞታዎቻችን ላይ ሊፈጸሙ የሚችሉትን ህገ-ወጥ ድርጊቶችን ክትትል ማድረግ", "isDone": false, "rollNo": 7, "status": "To Do", "taskId": 39, "weight": "0.75", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-27T04:00:13.078Z", "updatedAt": "2025-11-12T19:53:43.911Z", "description": null, "targetMetric": {"በወር": "12"}, "currentMetric": {}, "previousMetric": {"በወር": ""}, "quarterlyGoals": {"q1": 3, "q2": 3, "q3": 3, "q4": 3}}	2025-11-12 22:53:43.911819+03
219	1	ACTIVITY_UPDATED	Activity	195	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 195, "title": "ኤጃንሲው ከሚያስተዳድራቸው ቤቶች አመታዊ ገቢ መሰብሰብ", "isDone": false, "rollNo": 8, "status": "To Do", "taskId": 39, "weight": "1", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-27T04:02:38.596Z", "updatedAt": "2025-10-27T04:02:46.480Z", "description": null, "targetMetric": {"በብር": "18745715"}, "currentMetric": {}, "previousMetric": {"በብር": "14626326"}, "quarterlyGoals": {}}	{"id": 195, "title": "ኤጃንሲው ከሚያስተዳድራቸው ቤቶች አመታዊ ገቢ መሰብሰብ", "isDone": false, "rollNo": 8, "status": "To Do", "taskId": 39, "weight": "1", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-27T04:02:38.596Z", "updatedAt": "2025-11-12T19:55:22.347Z", "description": null, "targetMetric": {"በብር": "1874571500"}, "currentMetric": {}, "previousMetric": {"በብር": "14626326"}, "quarterlyGoals": {"q1": 3749143, "q2": 5623714, "q3": 5623714, "q4": 2749143}}	2025-11-12 22:55:22.34703+03
220	1	ACTIVITY_UPDATED	Activity	196	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 196, "title": "ሁለት የክፍያ አማራጭ ስርዓትን በመዘርጋት አሰራርን ማዘመን", "isDone": false, "rollNo": 9, "status": "To Do", "taskId": 39, "weight": "0.4", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-27T04:03:25.069Z", "updatedAt": "2025-10-27T04:03:25.069Z", "description": null, "targetMetric": {"በክፍያ አማራጭ ብዛት": "2"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 196, "title": "ሁለት የክፍያ አማራጭ ስርዓትን በመዘርጋት አሰራርን ማዘመን", "isDone": false, "rollNo": 9, "status": "To Do", "taskId": 39, "weight": "0.4", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-27T04:03:25.069Z", "updatedAt": "2025-11-12T19:55:52.026Z", "description": null, "targetMetric": {"በክፍያ አማራጭ ብዛት": "2"}, "currentMetric": {}, "previousMetric": {"በክፍያ አማራጭ ብዛት": ""}, "quarterlyGoals": {"q2": 1, "q3": 1}}	2025-11-12 22:55:52.026029+03
221	1	ACTIVITY_UPDATED	Activity	197	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 197, "title": "ለቦርድ ቀርቦ የሚፀድቀውን የመኖሪያ ቤቶችን የሽያጭ ማስተላለፍ ጥናትን ተግባራዊ ማድረግ", "isDone": false, "rollNo": 10, "status": "To Do", "taskId": 39, "weight": "0.01", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-27T04:04:39.759Z", "updatedAt": "2025-10-27T04:04:57.505Z", "description": null, "targetMetric": {"በቁጥር": "100"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 197, "title": "ለቦርድ ቀርቦ የሚፀድቀውን የመኖሪያ ቤቶችን የሽያጭ ማስተላለፍ ጥናትን ተግባራዊ ማድረግ", "isDone": false, "rollNo": 10, "status": "To Do", "taskId": 39, "weight": "0.01", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-27T04:04:39.759Z", "updatedAt": "2025-11-12T19:57:02.394Z", "description": null, "targetMetric": {"በቁጥር": "100"}, "currentMetric": {}, "previousMetric": {"በቁጥር": ""}, "quarterlyGoals": {"q1": 30, "q2": 70}}	2025-11-12 22:57:02.394028+03
222	1	ACTIVITY_UPDATED	Activity	198	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 198, "title": "ከባለሀብቶች ጋር በመጣመር በኤጀንሲው ይዞታ ላይ ቅይጥ አገልግሎት የሚሰጡ ህንፃዎችን መገንባት", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 40, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-27T04:06:39.325Z", "updatedAt": "2025-10-27T04:06:58.170Z", "description": null, "targetMetric": {"በቁጥር": "3"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 198, "title": "ከባለሀብቶች ጋር በመጣመር በኤጀንሲው ይዞታ ላይ ቅይጥ አገልግሎት የሚሰጡ ህንፃዎችን መገንባት", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 40, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-27T04:06:39.325Z", "updatedAt": "2025-11-12T19:57:37.957Z", "description": null, "targetMetric": {"በቁጥር": "3"}, "currentMetric": {}, "previousMetric": {"በቁጥር": ""}, "quarterlyGoals": {"q4": 3}}	2025-11-12 22:57:37.957493+03
223	1	ACTIVITY_UPDATED	Activity	199	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 199, "title": "በኤጀንሲው ይዞታ ላይ B+G+4 የጋራ መኖሪያ ኮንዶሚኒየም ህንጻ መገንባት", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 40, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-27T04:07:30.771Z", "updatedAt": "2025-10-27T04:07:38.558Z", "description": null, "targetMetric": {"በቁጥር": "1"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 199, "title": "በኤጀንሲው ይዞታ ላይ B+G+4 የጋራ መኖሪያ ኮንዶሚኒየም ህንጻ መገንባት", "isDone": false, "rollNo": 2, "status": "To Do", "taskId": 40, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-27T04:07:30.771Z", "updatedAt": "2025-11-12T19:57:53.481Z", "description": null, "targetMetric": {"በቁጥር": "1"}, "currentMetric": {}, "previousMetric": {"በቁጥር": ""}, "quarterlyGoals": {"q4": 1}}	2025-11-12 22:57:53.481488+03
224	1	ACTIVITY_UPDATED	Activity	200	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 200, "title": "መኖሪያ ቤቶችን ለተከራይ ደንበኞች በሽያጭ ለማስተላለፍ የተሰራውን ጥናት ለቦርድ አቅርቦ ማፀደቅ", "isDone": false, "rollNo": 3, "status": "To Do", "taskId": 40, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-27T04:08:15.390Z", "updatedAt": "2025-10-27T04:08:23.337Z", "description": null, "targetMetric": {"በሰነድ": "1"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 200, "title": "መኖሪያ ቤቶችን ለተከራይ ደንበኞች በሽያጭ ለማስተላለፍ የተሰራውን ጥናት ለቦርድ አቅርቦ ማፀደቅ", "isDone": false, "rollNo": 3, "status": "To Do", "taskId": 40, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-27T04:08:15.390Z", "updatedAt": "2025-11-12T19:58:55.350Z", "description": null, "targetMetric": {"በሰነድ": "1"}, "currentMetric": {}, "previousMetric": {"በሰነድ": ""}, "quarterlyGoals": {"q1": 1}}	2025-11-12 22:58:55.350486+03
225	1	ACTIVITY_UPDATED	Activity	201	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 201, "title": "የቀድሞ ሲቪል ሰርቪስ ቢሮ ምድር ላይ ያሉትን አራት የፅ/ቤት ክፍሎችን ወደ ንግድ ቤት መቀየር", "isDone": false, "rollNo": 4, "status": "To Do", "taskId": 40, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-27T04:09:00.747Z", "updatedAt": "2025-10-27T04:09:09.114Z", "description": null, "targetMetric": {"በቁጥር": "4"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "0"}, "quarterlyGoals": {}}	{"id": 201, "title": "የቀድሞ ሲቪል ሰርቪስ ቢሮ ምድር ላይ ያሉትን አራት የፅ/ቤት ክፍሎችን ወደ ንግድ ቤት መቀየር", "isDone": false, "rollNo": 4, "status": "To Do", "taskId": 40, "weight": "0.25", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-27T04:09:00.747Z", "updatedAt": "2025-11-12T19:59:20.711Z", "description": null, "targetMetric": {"በቁጥር": "4"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "0"}, "quarterlyGoals": {"q2": 4}}	2025-11-12 22:59:20.71196+03
226	1	ACTIVITY_UPDATED	Activity	202	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 202, "title": "ለወሳኝ ኩነት ቢሮ አጥርና ቢሮ መገንባት", "isDone": false, "rollNo": 5, "status": "To Do", "taskId": 40, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-27T04:10:09.522Z", "updatedAt": "2025-10-27T04:10:16.208Z", "description": null, "targetMetric": {"በቁጥር": "1"}, "currentMetric": {}, "previousMetric": {}, "quarterlyGoals": {}}	{"id": 202, "title": "ለወሳኝ ኩነት ቢሮ አጥርና ቢሮ መገንባት", "isDone": false, "rollNo": 5, "status": "To Do", "taskId": 40, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-27T04:10:09.522Z", "updatedAt": "2025-11-12T19:59:48.183Z", "description": null, "targetMetric": {"በቁጥር": "1"}, "currentMetric": {}, "previousMetric": {"በቁጥር": ""}, "quarterlyGoals": {"q1": 1}}	2025-11-12 22:59:48.183998+03
227	1	ACTIVITY_UPDATED	Activity	203	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 203, "title": "ለምናስተዳድራቸው ቤቶች ጥገና እና እድሳት ማድረግ", "isDone": false, "rollNo": 6, "status": "To Do", "taskId": 40, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-27T04:11:10.382Z", "updatedAt": "2025-10-27T04:11:10.382Z", "description": null, "targetMetric": {"በቁጥር": "20"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "20"}, "quarterlyGoals": {}}	{"id": 203, "title": "ለምናስተዳድራቸው ቤቶች ጥገና እና እድሳት ማድረግ", "isDone": false, "rollNo": 6, "status": "To Do", "taskId": 40, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-27T04:11:10.382Z", "updatedAt": "2025-11-12T20:00:13.030Z", "description": null, "targetMetric": {"በቁጥር": "20"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "20"}, "quarterlyGoals": {"q1": 3, "q2": 7, "q3": 7, "q4": 3}}	2025-11-12 23:00:13.030106+03
228	1	ACTIVITY_UPDATED	Activity	204	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 204, "title": "ለምናስተዳድራቸው ቤቶች የይዞታ ማረጋገጫ ካርታ እንዲኖራቸው ማድረግ", "isDone": false, "rollNo": 7, "status": "To Do", "taskId": 40, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-27T04:11:55.349Z", "updatedAt": "2025-10-27T04:11:55.349Z", "description": null, "targetMetric": {"በቁጥር": "392"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "184"}, "quarterlyGoals": {}}	{"id": 204, "title": "ለምናስተዳድራቸው ቤቶች የይዞታ ማረጋገጫ ካርታ እንዲኖራቸው ማድረግ", "isDone": false, "rollNo": 7, "status": "To Do", "taskId": 40, "weight": "0.5", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-27T04:11:55.349Z", "updatedAt": "2025-11-12T20:00:32.740Z", "description": null, "targetMetric": {"በቁጥር": "392"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "184"}, "quarterlyGoals": {"q1": 80, "q2": 120, "q3": 120, "q4": 80}}	2025-11-12 23:00:32.740988+03
229	1	ACTIVITY_UPDATED	Activity	34	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 34, "title": "የተጠሪ ተቋማት ዕቅድን ከዘርፍ ዕቅድ ጋር ማናበብና ማጣጣም", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 11, "weight": "0.2", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:44:42.764Z", "updatedAt": "2025-11-11T12:46:10.753Z", "description": null, "targetMetric": {"በሰነድ": "6"}, "currentMetric": {}, "previousMetric": {"በሰነድ": "6"}, "quarterlyGoals": {"q1": 6}}	{"id": 34, "title": "የተጠሪ ተቋማት ዕቅድን ከዘርፍ ዕቅድ ጋር ማናበብና ማጣጣም", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 11, "weight": "0.1", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:44:42.764Z", "updatedAt": "2025-11-12T20:02:43.990Z", "description": null, "targetMetric": {"በሰነድ": "6"}, "currentMetric": {}, "previousMetric": {"በሰነድ": "6"}, "quarterlyGoals": {"q1": 6}}	2025-11-12 23:02:43.990041+03
230	1	ACTIVITY_CREATED	Activity	211	{"title": "ለተጠሪ ተቋማት እና ለወረዳ ወቅታዊ የአቅም ግንባታ ድጋፍ መስጠት", "rollNo": 23, "taskId": 11}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	\N	\N	2025-11-12 23:03:23.092067+03
231	1	ACTIVITY_UPDATED	Activity	34	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 34, "title": "የተጠሪ ተቋማት ዕቅድን ከዘርፍ ዕቅድ ጋር ማናበብና ማጣጣም", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 11, "weight": "0.1", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:44:42.764Z", "updatedAt": "2025-11-12T20:02:43.990Z", "description": null, "targetMetric": {"በሰነድ": "6"}, "currentMetric": {}, "previousMetric": {"በሰነድ": "6"}, "quarterlyGoals": {"q1": 6}}	{"id": 34, "title": "የተጠሪ ተቋማት ዕቅድን ከዘርፍ ዕቅድ ጋር ማናበብና ማጣጣም", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 11, "weight": "0.1", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:44:42.764Z", "updatedAt": "2025-11-12T20:10:16.371Z", "description": null, "targetMetric": {"በሰነድ": "6"}, "currentMetric": {}, "previousMetric": {"በሰነድ": "6"}, "quarterlyGoals": {"q1": 6}}	2025-11-12 23:10:16.371655+03
232	1	ACTIVITY_UPDATED	Activity	211	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 211, "title": "ለተጠሪ ተቋማት እና ለወረዳ ወቅታዊ የአቅም ግንባታ ድጋፍ መስጠት", "isDone": false, "rollNo": 23, "status": "To Do", "taskId": 11, "weight": "0.1", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-11-12T20:03:23.092Z", "updatedAt": "2025-11-12T20:03:23.092Z", "description": null, "targetMetric": {"በቁጥር": "2"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "2"}, "quarterlyGoals": {"q2": 1, "q3": 1}}	{"id": 211, "title": "ለተጠሪ ተቋማት እና ለወረዳ ወቅታዊ የአቅም ግንባታ ድጋፍ መስጠት", "isDone": false, "rollNo": 7, "status": "To Do", "taskId": 11, "weight": "0.01", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-11-12T20:03:23.092Z", "updatedAt": "2025-11-12T20:10:46.594Z", "description": null, "targetMetric": {"በቁጥር": "2"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "2"}, "quarterlyGoals": {"q2": 1, "q3": 1}}	2025-11-12 23:10:46.594063+03
233	1	ACTIVITY_UPDATED	Activity	34	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 34, "title": "የተጠሪ ተቋማት ዕቅድን ከዘርፍ ዕቅድ ጋር ማናበብና ማጣጣም", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 11, "weight": "0.1", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:44:42.764Z", "updatedAt": "2025-11-12T20:10:16.371Z", "description": null, "targetMetric": {"በሰነድ": "6"}, "currentMetric": {}, "previousMetric": {"በሰነድ": "6"}, "quarterlyGoals": {"q1": 6}}	{"id": 34, "title": "የተጠሪ ተቋማት ዕቅድን ከዘርፍ ዕቅድ ጋር ማናበብና ማጣጣም", "isDone": false, "rollNo": 1, "status": "To Do", "taskId": 11, "weight": "0.2", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-10-12T21:44:42.764Z", "updatedAt": "2025-11-12T20:10:55.400Z", "description": null, "targetMetric": {"በሰነድ": "6"}, "currentMetric": {}, "previousMetric": {"በሰነድ": "6"}, "quarterlyGoals": {"q1": 6}}	2025-11-12 23:10:55.400303+03
234	1	ACTIVITY_UPDATED	Activity	211	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 211, "title": "ለተጠሪ ተቋማት እና ለወረዳ ወቅታዊ የአቅም ግንባታ ድጋፍ መስጠት", "isDone": false, "rollNo": 7, "status": "To Do", "taskId": 11, "weight": "0.01", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-11-12T20:03:23.092Z", "updatedAt": "2025-11-12T20:10:46.594Z", "description": null, "targetMetric": {"በቁጥር": "2"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "2"}, "quarterlyGoals": {"q2": 1, "q3": 1}}	{"id": 211, "title": "ለተጠሪ ተቋማት እና ለወረዳ ወቅታዊ የአቅም ግንባታ ድጋፍ መስጠት", "isDone": false, "rollNo": 7, "status": "To Do", "taskId": 11, "weight": "0.0999999998", "dueDate": null, "parentId": null, "progress": 0, "createdAt": "2025-11-12T20:03:23.092Z", "updatedAt": "2025-11-12T20:11:21.199Z", "description": null, "targetMetric": {"በቁጥር": "2"}, "currentMetric": {}, "previousMetric": {"በቁጥር": "2"}, "quarterlyGoals": {"q2": 1, "q3": 1}}	2025-11-12 23:11:21.199801+03
235	1	USER_LOGIN_SUCCESS	Auth	\N	{"username": "admin"}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	\N	\N	2025-11-15 16:26:59.443975+03
236	1	REPORT_SUBMITTED	Report	1	{"activityId": "5"}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	\N	\N	2025-11-15 22:40:44.366922+03
237	1	GROUP_CREATED	Group	1	{"name": "vskdlnvklsn"}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	\N	\N	2025-11-15 23:30:49.438001+03
238	1	GROUP_UPDATED	Group	1	{}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 1, "name": "vskdlnvklsn", "createdAt": "2025-11-15T20:30:49.438Z", "updatedAt": "2025-11-15T20:30:49.438Z", "description": "ncakndvlknadkvl", "profilePicture": "1763238649405_397324__1___1_.jpg"}	{"id": 1, "name": "vskdlnvklsn vsndvjkndskjv", "createdAt": "2025-11-15T20:30:49.438Z", "updatedAt": "2025-11-15T20:31:15.012Z", "description": "ncakndvlknadkvl ksdmkvmsdkmsd", "profilePicture": "http://localhost:5000/api/groups/profile-picture/1763238675008_758332__1_.jpg"}	2025-11-15 23:31:15.012342+03
239	1	TEAM_MEMBER_ADDED	UserGroup	\N	{"groupId": 1, "addedUserId": 2}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	\N	\N	2025-11-15 23:31:24.598703+03
240	1	TEAM_MEMBER_ADDED	UserGroup	\N	{"groupId": 1, "addedUserId": 1}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	\N	\N	2025-11-15 23:31:28.264008+03
241	1	TEAM_MEMBER_REMOVED	UserGroup	\N	{"groupId": 1, "removedUserId": 2}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 1, "userId": 2, "groupId": 1, "createdAt": "2025-11-15T20:31:24.598Z", "updatedAt": "2025-11-15T20:31:24.598Z"}	\N	2025-11-15 23:31:35.100128+03
242	1	TEAM_MEMBER_REMOVED	UserGroup	\N	{"groupId": 1, "removedUserId": 1}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"id": 2, "userId": 1, "groupId": 1, "createdAt": "2025-11-15T20:31:28.264Z", "updatedAt": "2025-11-15T20:31:28.264Z"}	\N	2025-11-15 23:31:36.489736+03
\.


--
-- Data for Name: Goals; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Goals" (id, "rollNo", title, description, "groupId", "startDate", "endDate", status, progress, weight, "createdAt", "updatedAt") FROM stdin;
6	1	ተቋማዊ የማስፈጸም አቅም፣ የሀብት አጠቃቀም እና የአገልግሎት አሰጣጥ አሰራርን ማጎልበት	\N	4	\N	\N	Not Started	0	15	2025-10-12 23:58:39.118448+03	2025-11-12 23:11:21.199801+03
8	3	ፍላጎትን መሰረት ያደረገ፣ ፍትሃዊ የመሬት ዝግጅትና አቅርቦትን ማረጋገጥ	\N	9	\N	\N	Not Started	0	15	2025-10-13 06:27:07.214522+03	2025-11-11 17:03:23.642741+03
7	2	ክልላዊ ክትመትን በፕላን መምራት	\N	5	\N	\N	Not Started	0	17	2025-10-13 06:10:18.745342+03	2025-11-11 16:35:58.112345+03
9	4	የሐረር ከተማ የመሬት ይዞታ ማረጋገጥና ምዝገባ ሽፋንን በማሳደግ የአገልግሎት አሰጣጥ ስርዓትን መዘርጋትና ማዘመን	\N	6	\N	\N	Not Started	0	13	2025-10-13 06:43:49.841124+03	2025-11-12 21:37:56.347325+03
10	5	የህንፃን ደህንነትና አገልግሎት ሰጪነት ማረጋገጥ	\N	7	\N	\N	Not Started	0	15	2025-10-13 07:03:18.460378+03	2025-11-12 21:50:25.180837+03
11	6	በከተማና በገጠር የልማት ማዕከላት የቤት ልማት እንዲስፋፋና አስተዳደሩ እንዲዘምን ማድረግ እና የመንግስት ኮንስትራክሽን ሥራዎችን ማሻሻል	\N	8	\N	\N	Not Started	0	15	2025-10-13 07:22:39.626873+03	2025-11-12 22:47:38.659512+03
12	7	የመንግስት ቤቶችን ማስተዳደር እና ቤቶችን ማልማት	\N	10	\N	\N	Not Started	0	10	2025-10-27 06:49:26.877827+03	2025-11-12 23:00:32.740988+03
\.


--
-- Data for Name: Groups; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Groups" (id, name, description, "profilePicture", "createdAt", "updatedAt") FROM stdin;
4	ሁሉም ዳይሬክቶሬት	\N	\N	2025-10-27 07:12:48.123755+03	2025-10-27 07:12:48.123755+03
5	የከተማ ፕላን ኢንስትዩት	\N	\N	2025-10-27 07:12:56.279867+03	2025-10-27 07:12:56.279867+03
6	የመሬት ይዞታ ምዝገባና መረጃ ኤጀንሲ	\N	\N	2025-10-27 07:13:27.299404+03	2025-10-27 07:13:27.299404+03
7	የግንባታ ፈቃድና ቁጥጥር ባለስልጣን	\N	\N	2025-10-27 07:13:36.773649+03	2025-10-27 07:13:36.773649+03
8	የቤቶች ልማትና የመንግስት ኮንስትራክሽን ኤጀንሲ	\N	\N	2025-10-27 07:13:50.292781+03	2025-10-27 07:13:50.292781+03
9	የመሬት ልማትና ማኔጅመንት	\N	\N	2025-10-27 07:14:23.785258+03	2025-10-27 07:14:23.785258+03
10	የመንግስት ኪራይ ቤቶች አስተዳደር	\N	\N	2025-10-27 07:14:40.237717+03	2025-10-27 07:14:40.237717+03
\.


--
-- Data for Name: Notifications; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Notifications" (id, "userId", type, message, meta, level, "isRead", "createdAt") FROM stdin;
1	1	activity_updated	Activity "ወቅቱንና ጥራቱን የጠበቀ ዕቅድ ማዘጋጅት" updated.	{"activityId": 5}	info	f	2025-11-11 15:12:19.446665+03
2	1	activity_updated	Activity "ወቅቱንና ጥራቱን የጠበቀ ሪፖርት ማዘጋጀት" updated.	{"activityId": 6}	info	f	2025-11-11 15:12:51.574251+03
3	1	activity_updated	Activity "ወቅቱንና ጥራቱን የጠበቀ ግምገማ ማድረግ" updated.	{"activityId": 7}	info	f	2025-11-11 15:13:29.656459+03
4	1	activity_updated	Activity "የዘርፉን መረጃ አያያዝ በቴክኖሎጂ በመደገፍ ማደራጀት" updated.	{"activityId": 8}	info	f	2025-11-11 15:15:13.077369+03
5	1	activity_updated	Activity "ግልጽነት የሰፈነበት የሰው ኃይል ስምሪት ማካሄድ" updated.	{"activityId": 9}	info	f	2025-11-11 15:15:41.046527+03
6	1	activity_updated	Activity "ለአመራር እና ለሰራተኞች የሚሰጡ ሥልጠናዎችን ማሳደግ" updated.	{"activityId": 10}	info	f	2025-11-11 15:16:29.360027+03
7	1	activity_updated	Activity "የውስጥ የማበረታቻ ስርዓት መዘርጋት" updated.	{"activityId": 11}	info	f	2025-11-11 15:16:49.468991+03
8	1	activity_updated	Activity "የሰራተኛ ዕርካታን ማሳደግ" updated.	{"activityId": 12}	info	f	2025-11-11 15:24:48.5972+03
9	1	activity_updated	Activity "የሰራተኛ ዕርካታን ማሳደግ" updated.	{"activityId": 12}	info	f	2025-11-11 15:25:47.706074+03
10	1	activity_updated	Activity "የሰራተኛ ዕርካታን ማሳደግ" updated.	{"activityId": 12}	info	f	2025-11-11 15:26:03.061254+03
11	1	activity_updated	Activity "የሰራተኛ ዕርካታን ማሳደግ" updated.	{"activityId": 12}	info	f	2025-11-11 15:26:19.62857+03
12	1	activity_updated	Activity "የሰራተኛ ዕርካታን ማሳደግ" updated.	{"activityId": 12}	info	f	2025-11-11 15:26:29.882629+03
13	1	activity_updated	Activity "የሰራተኛ ፍልሰትን መቀነስ" updated.	{"activityId": 13}	info	f	2025-11-11 15:27:50.577056+03
14	1	activity_updated	Activity "የተመደበ በጀት በአግባቡ ሥራ ላይ ማዋል" updated.	{"activityId": 14}	info	f	2025-11-11 15:28:53.982853+03
15	1	activity_updated	Activity "የተመደበ በጀት በአግባቡ ሥራ ላይ ማዋል" updated.	{"activityId": 14}	info	f	2025-11-11 15:32:22.347318+03
16	1	activity_updated	Activity "ወቅቱን እና ጥራቱን የጠበቀ የሂሳብ ሪፖርት" updated.	{"activityId": 15}	info	f	2025-11-11 15:32:46.852514+03
17	1	activity_updated	Activity "የተመደበ በጀት በአግባቡ ሥራ ላይ ማዋል" updated.	{"activityId": 14}	info	f	2025-11-11 15:33:01.590446+03
18	1	activity_updated	Activity "የተመደበ በጀት በአግባቡ ሥራ ላይ ማዋል" updated.	{"activityId": 14}	info	f	2025-11-11 15:33:15.329828+03
19	1	activity_updated	Activity "በIBEX የተመዘገበ የበጀት ኮንትሮል ሪፖርት" updated.	{"activityId": 16}	info	f	2025-11-11 15:33:40.210043+03
20	1	activity_updated	Activity "ተዘጋጅቶ የጸደቀ የተቋሙ የግዥ እቅድ" updated.	{"activityId": 17}	info	f	2025-11-11 15:34:03.759174+03
21	1	activity_updated	Activity "በግዢ እቅዱ መሰረት የተዘጋጀ ሪፖርት" updated.	{"activityId": 18}	info	f	2025-11-11 15:34:53.037603+03
22	1	activity_updated	Activity "የተፈጸመ የግልጽ ጨረታ ግዢ ድርሻ" updated.	{"activityId": 19}	info	f	2025-11-11 15:35:23.530402+03
23	1	activity_updated	Activity "ወቅቱን እና ጥራቱን የጠበቀ የኦዲት ሪፖርት" updated.	{"activityId": 20}	info	f	2025-11-11 15:36:01.516062+03
24	1	activity_updated	Activity "ነቀፌታ ያለበትን የኦዲት ግኝት መቀነስ" updated.	{"activityId": 21}	info	f	2025-11-11 15:36:38.546517+03
25	1	activity_updated	Activity "አጠቃላይ ቆጠራ ተደርጎ፣ ዋጋ ተሰጥቶት፣ ተመዝግቦ መለያ ምልክት የተለጠፈበት ቋሚ ንብረት" updated.	{"activityId": 23}	info	f	2025-11-11 15:37:34.921908+03
26	1	activity_updated	Activity "አመታዊ የቋሚ ንብረት መግለጫ (አስ) ማዘጋጀት" updated.	{"activityId": 24}	info	f	2025-11-11 15:38:16.347594+03
27	1	activity_updated	Activity "የቋሚ ንብረት ጥገናና ዕድሳት ስኬጁል ማዘጋጀት" updated.	{"activityId": 25}	info	f	2025-11-11 15:38:39.489995+03
28	1	activity_updated	Activity "አመታዊ የቋሚ ንብረት መግለጫ (አስ) ማዘጋጀት" updated.	{"activityId": 24}	info	f	2025-11-11 15:38:50.304758+03
29	1	activity_updated	Activity "በፕሮግራሙ መሰረት ጥገና የተደረገላቸዉ ቋሚ ንብረቶች" updated.	{"activityId": 26}	info	f	2025-11-11 15:39:20.478936+03
30	1	activity_updated	Activity "የተመደበ በጀት በአግባቡ ሥራ ላይ ማዋል" updated.	{"activityId": 14}	info	f	2025-11-11 15:39:46.907308+03
31	1	activity_updated	Activity "መረጃ ቋት ማደራጀት" updated.	{"activityId": 27}	info	f	2025-11-11 15:41:41.285538+03
32	1	activity_updated	Activity "በተቋሙ ወረቀት አልባ አሰራርን መተግበር" updated.	{"activityId": 28}	info	f	2025-11-11 15:42:09.391792+03
33	1	activity_updated	Activity "በተቋሙ የሚሰጠ አገልግሎቶችን ኦቶሜት ማድረግ" updated.	{"activityId": 29}	info	f	2025-11-11 15:42:43.36416+03
34	1	activity_updated	Activity "የተሻሻለና ደህንነቱ የተረጋገጠ የኢኮቴ አጠቃቀም" updated.	{"activityId": 30}	info	f	2025-11-11 15:43:13.893596+03
35	1	activity_updated	Activity "ለተቋም አቅም ግንባታ በክልል ውስጥ አጋርነት የተገኘ ድጋፍ" updated.	{"activityId": 31}	info	f	2025-11-11 15:44:13.582663+03
36	1	activity_updated	Activity "ለተቋም አቅም ግንባታ በሀገር ዉስጥ አጋርነት የተገኘ ድጋፍ ለመሰብሰብ፤" updated.	{"activityId": 32}	info	f	2025-11-11 15:44:46.254719+03
37	1	activity_updated	Activity "መረጃዎችን በተለያዩ የተግባቦት ዘዴዎች ተደራሽ ማድረግ" updated.	{"activityId": 33}	info	f	2025-11-11 15:45:33.644028+03
38	1	activity_updated	Activity "የተጠሪ ተቋማት ዕቅድን ከዘርፍ ዕቅድ ጋር ማናበብና ማጣጣም" updated.	{"activityId": 34}	info	f	2025-11-11 15:46:10.792041+03
39	1	activity_updated	Activity "የየሩብ ዓመት የተጠሪ ተቋማት ሪፖርት መገምገም" updated.	{"activityId": 35}	info	f	2025-11-11 15:48:00.098594+03
40	1	activity_updated	Activity "የቢሮዉን/ተቋሙን ዕቅድ ከክልሉ ዕቅድ ጋር ማናበብና ማጣጣም" updated.	{"activityId": 36}	info	f	2025-11-11 15:48:34.652417+03
41	1	activity_updated	Activity "የተቋሙን/የቢሮዉን ዕቅድ ለወረዳ ማዉረድ" updated.	{"activityId": 37}	info	f	2025-11-11 15:49:12.833813+03
42	1	activity_updated	Activity "የተቋሙን/የቢሮዉን እና የወረዳን አፈጻጸም በየሩብ ዓመቱ በጋራ መገምገም" updated.	{"activityId": 38}	info	f	2025-11-11 15:49:44.422653+03
43	1	activity_updated	Activity "በብልሹ አሰራር ዙርያ ጥቆማ ከተደረገባቸው ውስጥ ማስተካከያ የተደረገባቸው" updated.	{"activityId": 39}	info	f	2025-11-11 15:50:57.594722+03
44	1	activity_updated	Activity "ለብልሹ አሰራር የተጋለጡ አሰራሮች በጥናት በመለየት የማሻሻያ ሀሳብ ማቅረብ" updated.	{"activityId": 40}	info	f	2025-11-11 15:51:23.027676+03
45	1	activity_updated	Activity "በቴክኖሎጂ የተደገፈ መሰረታዊ አገልግሎትን በቅልጥፍና በመስጠት የደንበኞችን እርካታ ማሻሻል" updated.	{"activityId": 41}	info	f	2025-11-11 15:51:42.74112+03
46	1	activity_updated	Activity "የሀብት ምዝገባ ያካሄዱ አመራሮች እና ባለሞያዎች ድርሻ ማሳደግ" updated.	{"activityId": 42}	info	f	2025-11-11 15:52:14.088864+03
47	1	activity_updated	Activity "የህጻናት ማቆያ አገልግሎት ተጠቃሚ ሰራተኞች ብዛት ማሳደግ" updated.	{"activityId": 43}	info	f	2025-11-11 15:53:05.298124+03
48	1	activity_updated	Activity "ወደ አመራር የመጡ ሴት ሰራተኞች ብዛት ማሳደግ" updated.	{"activityId": 44}	info	f	2025-11-11 15:53:33.50557+03
49	1	activity_updated	Activity "ሥልጠና ያገኙ ሴት ሰራተኞች ድርሻ ማሳደግ" updated.	{"activityId": 45}	info	f	2025-11-11 15:54:00.200982+03
50	1	activity_updated	Activity "ለአካል ጉዳተኛ ሰራተኞችና ተገልጋዮች ምቹ የስራ ሁኔታና ቦታ መፍጠር" updated.	{"activityId": 46}	info	f	2025-11-11 15:54:22.76129+03
51	1	activity_updated	Activity "የአረንጓዴ አሻራ ተግባራትን ማካሄድ የቀረበ ችግኝ" updated.	{"activityId": 47}	info	f	2025-11-11 15:57:52.436667+03
52	1	activity_updated	Activity "የአረንጓዴ አሻራ ተግባራትን ማካሄድ የተተከለ ችግኝ" updated.	{"activityId": 48}	info	f	2025-11-11 15:58:15.461971+03
53	1	activity_updated	Activity "የአረንጓዴ አሻራ ተግባራትን ክብካቤ የተደረገለት ችግኝ" updated.	{"activityId": 49}	info	f	2025-11-11 15:59:34.657269+03
54	1	activity_updated	Activity "የአረንጓዴ አሻራ ተግባራትን ማካሄድ የጸደቀ ችግኝ" updated.	{"activityId": 50}	info	f	2025-11-11 16:00:37.608982+03
55	1	activity_updated	Activity "የአቅመ ደካማ ማህበረሰቦች የመኖሪያ ቤቶች መገንባት (ማደስ) ብዛት" updated.	{"activityId": 51}	info	f	2025-11-11 16:01:05.772682+03
56	1	activity_updated	Activity "የአቅመ ደካማ ማህበረሰቦች የመኖሪያ ቤቶች መገንባት (ማደስ) በብር\t0.15\tበብር\t3ሚ" updated.	{"activityId": 52}	info	f	2025-11-11 16:03:44.27956+03
57	1	activity_updated	Activity "የአቅመ ደካማ ቤተሰብ ተማሪዎች ድጋፍ በገንዘብ" updated.	{"activityId": 53}	info	f	2025-11-11 16:04:50.214237+03
58	1	activity_updated	Activity "ለተለያዩ ማህበራዊ ቀውሶች የተደረገ ድጋፍ" updated.	{"activityId": 54}	info	f	2025-11-11 16:06:25.48891+03
59	1	activity_updated	Activity "የተደረገ ደም ልገሳ" updated.	{"activityId": 55}	info	f	2025-11-11 16:07:05.986244+03
60	1	activity_updated	Activity "ወላጆቻቸውን ያጡ ህፃናትን መደገፍ ብዛት በቁጥር" updated.	{"activityId": 56}	info	f	2025-11-11 16:07:31.798932+03
61	1	activity_updated	Activity "ወላጆቻቸውን ያጡ ህፃናትን መደገፍ በገንዘብ\t0.2\t\t20,000\t20,000" updated.	{"activityId": 57}	info	f	2025-11-11 16:08:00.541025+03
62	1	activity_updated	Activity "ወላጆቻቸውን ያጡ ህፃናትን መደገፍ በገንዘብ\t0.2\t\t20,000\t20,000" updated.	{"activityId": 57}	info	f	2025-11-11 16:09:02.847534+03
63	1	activity_updated	Activity "12 ነባር የአካባቢ ልማት ፕላን ዝግጅት ስራዎችን እንዲፀድቁ ለማድረግ የክትትል ሥራ መስራት" updated.	{"activityId": 58}	info	f	2025-11-11 16:13:15.999025+03
64	1	activity_updated	Activity "12 ነባር የአካባቢ ልማት ፕላን ዝግጅት ስራዎችን እንዲፀድቁ ለማድረግ የክትትል ሥራ መስራት" updated.	{"activityId": 58}	info	f	2025-11-11 16:14:39.161823+03
65	1	activity_updated	Activity "የሰፈር ልማት ፕላኖችን በአማካሪ ድርጅት ማዘጋጀት" updated.	{"activityId": 59}	info	f	2025-11-11 16:15:51.301881+03
66	1	activity_updated	Activity "ለሰፈር ልማት ፕላን ዝግጅት የሚሆኑ 4 መሰረታዊ ካርታዎች ማዘጋጀት" updated.	{"activityId": 60}	info	f	2025-11-11 16:16:28.756623+03
67	1	activity_updated	Activity "2 በመልሶ ማልማት የከተማ ዲዛይን በተመረጡ የከተማው እንብርት ቦታዎች በራስ አገዝ እንዲሰሩ ማድረግ" updated.	{"activityId": 61}	info	f	2025-11-11 16:17:24.742163+03
68	1	activity_updated	Activity "የፕላን ክፍሎችን፣ የማጠቃለያ ሰነዶችንና አሰራር ስታንደርዶችን ማሳተም" updated.	{"activityId": 62}	info	f	2025-11-11 16:18:10.256797+03
69	1	activity_updated	Activity "አንድ ቤዚክ ፕላን ለገጠር ጥንስስ ከተማ ማዘጋጀት በራስ አገዝ ማዘጋጀት" updated.	{"activityId": 63}	info	f	2025-11-11 16:18:40.070551+03
70	1	activity_updated	Activity "በዩን ሃቢታት አየተዘጋጀ ያለው ክልላዊ ሰፓሻል ፕላንን የተረከብነውን በክልል ምክር ቤት እንዲፀድቅ ክትትል ማድረግ" updated.	{"activityId": 64}	info	f	2025-11-11 16:19:07.795409+03
71	1	activity_updated	Activity "በፕላን የሚመሩ የገጠር ማዕከላት ሽፋን ማሳደግ" updated.	{"activityId": 65}	info	f	2025-11-11 16:19:45.82722+03
72	1	activity_updated	Activity "በፕላን የሚመሩ ከተሞች ሽፋን ማሳደግ" updated.	{"activityId": 66}	info	f	2025-11-11 16:20:41.054778+03
73	1	activity_updated	Activity "የሰፈር ልማት ፕላኖች ሽፋን ማሳደግ" updated.	{"activityId": 67}	info	f	2025-11-11 16:21:18.421075+03
74	1	activity_updated	Activity "ገጠር ከገጠር እና ገጠር ከከተማ የትስስር ጥናት ማዘጋጀት" updated.	{"activityId": 68}	info	f	2025-11-11 16:22:17.160398+03
75	1	activity_updated	Activity "ገጠር ከገጠር እና ገጠር ከከተማ የትስስር ጥናት ማዘጋጀት" updated.	{"activityId": 68}	info	f	2025-11-11 16:22:32.9933+03
76	1	activity_updated	Activity "የገጠር ኮሪደር ልማት የሚዘጋጅላቸው የገጠር ዕድገት ማእከላት ስኬች ፕላን ጥናቶችን ማዘጋጀት" updated.	{"activityId": 69}	info	f	2025-11-11 16:23:42.323237+03
77	1	activity_updated	Activity "በተዘጋጁ ስኬች ፕላን ጥናት ላይ ለሚመለከታቸው ባለድርሻ አካለት የግንዛቤ መፍጠሪያ መድረክ ማዘጋጀት" updated.	{"activityId": 70}	info	f	2025-11-11 16:24:22.274714+03
78	1	activity_updated	Activity "ከተሞች ወደ Smart city ትግበራ እንዲገቡ ይደረጋል የጥናትና የዝግጅት ምዕራፍ ሥራዎች መስራት" updated.	{"activityId": 71}	info	f	2025-11-11 16:25:03.009847+03
79	1	activity_updated	Activity "የከተማ ፕላን ዝግጅትና ትግበራን ለማስፈፀም በተዘጋጁ ማኑዋሎች፣ ስታንዳርዶችና የአሰራር ስርአቶች ለባለሙያዎች (50% ሴቶች) ተግባር ተኮር የሆነ ስልጠና ይሰጣል፡፡" updated.	{"activityId": 72}	info	f	2025-11-11 16:25:46.226076+03
80	1	activity_updated	Activity "የስፓሻል ፕላን ትግበራ ላይ ክትትልና ቁጥጥር ማድረግ" updated.	{"activityId": 73}	info	f	2025-11-11 16:26:32.605408+03
81	1	activity_updated	Activity "የአረንጓዴ ልማት ፕላን ትግበራ ላይ ክትትልና ቁጥጥር ማድረግ" updated.	{"activityId": 74}	info	f	2025-11-11 16:27:08.441903+03
82	1	activity_updated	Activity "የማህበረ ኢኮኖሚ ፕላን ትግበራ ላይ ክትትልና ቁጥጥር ማድረግ" updated.	{"activityId": 75}	info	f	2025-11-11 16:27:35.503213+03
83	1	activity_updated	Activity "የቅርስ ጥበቃ ፕላን ትግበራ ላይ ክትትልና ቁጥጥር ማድረግ" updated.	{"activityId": 76}	info	f	2025-11-11 16:28:30.687433+03
84	1	activity_updated	Activity "የመሬት ሽንሻኖ ፕላን ትግበራ ላይ ክትትልና ቁጥጥር ማድረግ" updated.	{"activityId": 77}	info	f	2025-11-11 16:29:03.209559+03
85	1	activity_updated	Activity "ባለድርሻ ተቋማት በመዋቅራዊ ፕላን ትግበራ የመልሶ ማልማት ፤የቤቶች ልማት፤የቅርስ ጥበቃና የመንገድ መረበብ የትግበራ ፕሮፖዛል በመለየት ከፕሮፖዛሎች አንፃር ስራቸውን ማከናወን በሚያስችል የስራ ትብብር ዙሪያ መግባቢያ ሰነድ መፈራረም" updated.	{"activityId": 78}	info	f	2025-11-11 16:29:28.392171+03
86	1	activity_updated	Activity "ለሚፀድቁት ሰፈር ልማት ፕላን ትግበራ ላይ ክትትልና ቁጥጥር ማድረግ" updated.	{"activityId": 79}	info	f	2025-11-11 16:29:55.753433+03
87	1	activity_updated	Activity "የኤረርና ድሬጠያራ ከተሞች ፕላን ክትትልና ድጋፍ ማድረግ" updated.	{"activityId": 80}	info	f	2025-11-11 16:30:22.616961+03
88	1	activity_updated	Activity "የከተማ ፕላን ትግበራ ክትትልና ቁጥጥር ሽፋን ማሳደግ" updated.	{"activityId": 81}	info	f	2025-11-11 16:30:54.673375+03
89	1	activity_updated	Activity "የማስተግበሪያ ሰነድ ማዘጋጀት" updated.	{"activityId": 82}	info	f	2025-11-11 16:33:06.068689+03
90	1	activity_updated	Activity "የተዘጋጁ ፕላኖችንና የማስፈጸሚያ ዕቅዶቹ ላይ ስልጠና መስጠት" updated.	{"activityId": 83}	info	f	2025-11-11 16:33:33.956037+03
91	1	activity_updated	Activity "በሚመለከታቸዉ አካላት እንዲፀድቅ ክትትል ማድረግ" updated.	{"activityId": 84}	info	f	2025-11-11 16:34:06.823725+03
92	1	activity_updated	Activity "ወረዳዎቹንና የልማት ማዕከላቱን የባለሞያ ድጋፍ መስጠት" updated.	{"activityId": 85}	info	f	2025-11-11 16:34:41.303914+03
93	1	activity_updated	Activity "የከተማ ፕላን ክዋኔ ኦዲት አመታዊ መርሃ ግብር ማዘጋጀት" updated.	{"activityId": 86}	info	f	2025-11-11 16:35:22.782441+03
94	1	activity_updated	Activity "የከተማ ፕላን ትግበራ ክዋኔ ኦዲት ማካሄድ" updated.	{"activityId": 87}	info	f	2025-11-11 16:35:58.147568+03
95	1	activity_updated	Activity "የመሬት ፍላጎትንና መቸት መለየት" updated.	{"activityId": 88}	info	f	2025-11-11 16:37:17.806766+03
96	1	activity_updated	Activity "የመሬት ማዘጋጀት" updated.	{"activityId": 89}	info	f	2025-11-11 16:38:27.508799+03
97	1	activity_updated	Activity "መሬት ባንክ ገቢ ማድረግ" updated.	{"activityId": 90}	info	f	2025-11-11 16:39:02.547005+03
98	1	activity_updated	Activity "ለተሻሻለው የካሳ አዋጅ ቁጥር 1336/2016 ማስፈጸሚያ ክልላዊ መመርያ እንዲዘጋጅ ይደረጋል" updated.	{"activityId": 91}	info	f	2025-11-11 16:39:27.528956+03
99	1	activity_updated	Activity "መሬት ለልማት ማስተላለፍ" updated.	{"activityId": 92}	info	f	2025-11-11 16:40:10.512342+03
100	1	activity_updated	Activity "ለመኖሪያ ቤት የተላለፈ መሬት" updated.	{"activityId": 93}	info	f	2025-11-11 16:41:27.947657+03
101	1	activity_updated	Activity "ለንግድ አገልግሎት የተላለፈ መሬት" updated.	{"activityId": 94}	info	f	2025-11-11 16:42:09.019548+03
102	1	activity_updated	Activity "ለማህበራዊ አገልግሎት የተላለፈ መሬት" updated.	{"activityId": 95}	info	f	2025-11-11 16:43:10.952844+03
103	1	activity_updated	Activity "አስተዳደራዊ አገልግሎት የተላለፈ መሬት" updated.	{"activityId": 96}	info	f	2025-11-11 16:43:56.426158+03
104	1	activity_updated	Activity "ለኢንዱስትሪ አገልግሎት የተላለፈ መሬት" updated.	{"activityId": 97}	info	f	2025-11-11 16:44:44.687131+03
105	1	activity_updated	Activity "ለመንገድ፣ ትራንስፖርትና ዩቲሉቲ ልማት አገልግሎት የተላለፈ መሬት" updated.	{"activityId": 98}	info	f	2025-11-11 16:45:21.793311+03
106	1	activity_updated	Activity "ለከተማ ግብርና አገልግለሎት የተላለፈ መሬት" updated.	{"activityId": 99}	info	f	2025-11-11 16:46:18.788041+03
107	1	activity_updated	Activity "ለአረንጓዴ፣ ለመዝናኛና አከባቢ ጥበቃ የተላለፈ/የተጠበቀ መሬት" updated.	{"activityId": 100}	info	f	2025-11-11 16:47:02.298377+03
108	1	activity_updated	Activity "አዲስ ይዞታ ማረጋገጫ ማስረጃ መስጠት" updated.	{"activityId": 101}	info	f	2025-11-11 16:49:16.377754+03
109	1	activity_updated	Activity "የመሬት ህገወጥ ይዞታዎችን ማስለቀቅ" updated.	{"activityId": 102}	info	f	2025-11-11 16:49:51.353043+03
110	1	activity_updated	Activity "ለሰነድ አልባ ይዞታዎች እና የመንግስት ተቋም (የቀበሌ እና ኪራይ ቤት) ሰነድ መስጠት" updated.	{"activityId": 103}	info	f	2025-11-11 16:51:47.346262+03
111	1	activity_updated	Activity "የመሬት ይዞታን ማሻሻል" updated.	{"activityId": 104}	info	f	2025-11-11 16:53:04.158915+03
143	1	activity_updated	Activity "የሪል ፕሮፐርቲ ዳታ ቤዝ ማልማት" updated.	{"activityId": 135}	info	f	2025-11-12 21:37:38.469412+03
112	1	activity_updated	Activity "በክልሉ 5,000 በቁራሽ መሬት (10 ሄክታር) ላይ የሚገኝ የመሬት ሀብታቸውን ቆጥረውና መዝግበው ወቅታዊ እንዲያደርጉና እንዲያስተዳድሩ ይደረጋል" updated.	{"activityId": 105}	info	f	2025-11-11 16:55:43.977375+03
113	1	activity_updated	Activity "በክልሉ 5,000 በቁራሽ መሬት (10 ሄክታር) ላይ የሚገኝ የመሬት ሀብታቸውን ቆጥረውና መዝግበው ወቅታዊ እንዲያደርጉና እንዲያስተዳድሩ ይደረጋል" updated.	{"activityId": 106}	info	f	2025-11-11 16:56:51.358902+03
114	1	activity_updated	Activity "ከመሬት ነክ ቋሚ ንብረት ገቢን ማሰባሰብ" updated.	{"activityId": 107}	info	f	2025-11-11 16:58:49.752744+03
115	1	activity_updated	Activity "ለልማት ተነሺዎች ካሳ መክፈል" updated.	{"activityId": 108}	info	f	2025-11-11 17:00:14.108443+03
116	1	activity_updated	Activity "የመሬት ይዞታ ማህደራትን ማደራጀት" updated.	{"activityId": 109}	info	f	2025-11-11 17:01:40.165015+03
117	1	activity_updated	Activity "ካደስተር ምዝገባዉ ተደራሽ ማድረግ" updated.	{"activityId": 110}	info	f	2025-11-11 17:03:23.720992+03
118	1	activity_updated	Activity "የህጋዊ ካዳስተር ስርዓትን ለመተግበር የሚያስፈልጉ የሲስተም ፣ ማረጋገጥና ምዝገባ ግብአቶችን እንዲሟላ ስፔስፊኬሽን ሰነድ ማዘጋጀት" updated.	{"activityId": 111}	info	f	2025-11-11 17:04:18.79443+03
119	1	activity_updated	Activity "ቅሬታ ሰሚ ጉባኤ ማደራጀትና ታዛቢ ኮሚቴ ማዋቀር" updated.	{"activityId": 112}	info	f	2025-11-11 17:05:01.269332+03
120	1	activity_updated	Activity "ለተመረጡ ቅሬታ ሰሚ ጉባኤ እና ታዛቢ ኮሚቴ አባላት ማበረታቻ ክፍያ መመሪያ ማዘጋጀት" updated.	{"activityId": 113}	info	f	2025-11-11 17:05:38.24397+03
121	1	activity_updated	Activity "ከመብት ፈጣሪ ተቋም (መሬት ልማት ማኔጅመንት) የተደራጁ የይዞታ ፋይሎችን በደንቡ መሰረት መረከብ" updated.	{"activityId": 114}	info	f	2025-11-11 17:06:35.33613+03
122	1	activity_updated	Activity "ሕጋዊ ካዳስተር ለመተግበር ለፈጻሚዎችንና አስፈጻሚ አካላት የግንዛቤ ማስጨበጫ ስልጠና መስጠት" updated.	{"activityId": 115}	info	f	2025-11-11 17:07:12.385259+03
123	1	activity_updated	Activity "የከተማ መሬት ምዝገባ ፕሮግራም ለማስፈጸም የሚያስችል ለህብረተሰብ ግንዛቤ ማስጨበጫ መስጠት" updated.	{"activityId": 116}	info	f	2025-11-11 17:08:02.087545+03
124	1	activity_updated	Activity "ኦርቶፎቶ በመጠቀም ለመሬት ይዞታ ማረጋገጫ ማከናወኛ ካርታና ኢንዴክስ ማፕ ማዘጋጀት" updated.	{"activityId": 117}	info	f	2025-11-11 17:08:56.979394+03
125	1	activity_updated	Activity "ከባለድረሻ አካላት ጋር MOU መፈራረም" updated.	{"activityId": 118}	info	f	2025-11-11 17:09:24.458654+03
126	1	activity_updated	Activity "በተመረጡ ቀጠናዎች ውስጥ ይዞታዎችን የወሰን ማካለል ስራ መስራት" updated.	{"activityId": 119}	info	f	2025-11-11 17:10:27.704744+03
127	1	activity_updated	Activity "በተመረጡ ቀጠናዎች ውስጥ ይዞታዎችን የቅየሳ ስራ መስራት" updated.	{"activityId": 120}	info	f	2025-11-11 17:11:13.385598+03
128	1	activity_updated	Activity "የመሬት ይዞታን ማረጋገጥ" updated.	{"activityId": 121}	info	f	2025-11-11 17:12:27.961995+03
129	1	activity_updated	Activity "የመሬት ይዞታ ማህደሮች ከኦርቶፎቶ/ከካዳስተር መሰረታዊ ካርታ ጋር በቁራሽ መሬት ልዩ ኮድ እንዲተሳሰሩ ማድረግ" updated.	{"activityId": 122}	info	f	2025-11-11 17:13:21.445942+03
130	1	activity_updated	Activity "የካዳስተር ቁራሽ መሬት የይዞታ ማረጋገጫ ካርታ እንዲዘጋጅ ማድረግ" updated.	{"activityId": 123}	info	f	2025-11-11 17:14:12.901159+03
131	1	activity_updated	Activity "የአድራሻ ስርዓት ካርታ በአማካሪ የትግበራ አፕሊኬሽን እንዲዘጋጅ ማድረግ" updated.	{"activityId": 124}	info	f	2025-11-11 17:15:13.420729+03
132	1	activity_updated	Activity "ምዝገባ ለተደረገላቸው ይዞታዎች ለሚሰጡ አገልግሎቶች አገልግሎት አሰጣጡ ወጪና ጊዜ ቆጣቢ፣ ፈጣንና ተደራሽ እንዲሆን ክትትልና ድጋፍ ማድረግ" updated.	{"activityId": 125}	info	f	2025-11-11 17:15:44.573577+03
133	1	activity_updated	Activity "በማረጋገጥ ሂደቱ ብቁ የሆኑትን ይዞታወችን በሲስተም በመመዝገብ የምዝገባ ሰርቲፊኬት መስጠት" updated.	{"activityId": 126}	info	f	2025-11-11 17:16:52.33517+03
134	1	activity_updated	Activity "በማረጋገጥ ሂደቱ ብቁ የሆኑትን ይዞታወችን በማንዋል በመመዝገብ የምዝገባ ሰርቲፊኬት መስጠት" updated.	{"activityId": 127}	info	f	2025-11-11 17:18:27.17988+03
135	1	activity_updated	Activity "የመሬት ይዞታ ማረጋገጥና ምዝገባ አገልገሎት መስጠት" updated.	{"activityId": 128}	info	f	2025-11-11 17:19:51.591342+03
136	1	activity_updated	Activity "በሲስተም የተመዘገቡትን ይዞታዎች አገልገሎት በመስጠት ገቢ መሰብሰብ" updated.	{"activityId": 129}	info	f	2025-11-11 17:20:59.776871+03
137	1	activity_updated	Activity "የካዳስተርን ሽፋን ማሳደግ" updated.	{"activityId": 130}	info	f	2025-11-11 17:22:03.417288+03
138	1	activity_updated	Activity "በከተሞች ለንብረት ግመታ የከተማ ቦታ ደረጃ መመሪያ እና የከተማ ቦታና ቤት ግብር ደንብ ማሻሻል ፣" updated.	{"activityId": 131}	info	f	2025-11-12 21:34:29.96017+03
139	1	activity_updated	Activity "በከተሞች የሪል ንብረቶች ዋጋ ግመታ በማካሄድ ገቢ መሰብሰብ፣" updated.	{"activityId": 132}	info	f	2025-11-12 21:35:31.594489+03
140	1	activity_updated	Activity "በከተሞች የሪል ንብረቶች ዋጋ ግመታ በማካሄድ ሽፋኑን 70 በመቶ ማድረስ፣" updated.	{"activityId": 133}	info	f	2025-11-12 21:36:00.436255+03
141	1	activity_updated	Activity "በከተሞች ለንብረት ግመታ የከተማ ቦታ ደረጃ መመሪያ እና የከተማ ቦታና ቤት ግብር ደንብ ማሻሻል ፣" updated.	{"activityId": 131}	info	f	2025-11-12 21:37:10.320879+03
142	1	activity_updated	Activity "በክልሉ የሪል ፕሮፐርቲ ግብይት ግመታና ፈቃድ አሰጣጥ ስርዓት አደረጃጀት እንዲፈጠር ማድረግ (ፈቃድ በክልል ደረጃ እና በፌደራል ደረጃ ይሰጣል ስለዚህ በክልል እንዲሰጠጥ ማድረግ)" updated.	{"activityId": 134}	info	f	2025-11-12 21:37:21.213047+03
144	1	activity_updated	Activity "የክልሉ መረጃ በሀገር ዓቀፍ ደረጃ በለማው የሪል ፕሮፐርቲ ፕላትፎርምና ኦብዘርቫቶሪ ሲስተም ላይ እንዲጫን ይደረጋል" updated.	{"activityId": 136}	info	f	2025-11-12 21:37:49.0951+03
145	1	activity_updated	Activity "በከተሞች ለንብረት ግመታ የከተማ ቦታ ደረጃ መመሪያ እና የከተማ ቦታና ቤት ግብር ደንብ ማሻሻል ፣" updated.	{"activityId": 131}	info	f	2025-11-12 21:37:56.405704+03
146	1	activity_updated	Activity "የተሰጠ የፕላን ስምምነት" updated.	{"activityId": 137}	info	f	2025-11-12 21:39:14.087728+03
147	1	activity_updated	Activity "የተሰጠ አዲስ የግንባታ ፍቃድ" updated.	{"activityId": 138}	info	f	2025-11-12 21:40:01.969016+03
148	1	activity_updated	Activity "የተሰጠ አዲስ የግንባታ ፍቃድ" updated.	{"activityId": 138}	info	f	2025-11-12 21:40:10.923172+03
149	1	activity_updated	Activity "የተሰጠ የግንባታ ፍቃድ ማሻሻያ ፍቃድ" updated.	{"activityId": 139}	info	f	2025-11-12 21:40:44.425133+03
150	1	activity_updated	Activity "የተሰጠ የግንባታ ማራዘሚያ ፍቃድ" updated.	{"activityId": 140}	info	f	2025-11-12 21:41:23.873265+03
151	1	activity_updated	Activity "የተሰጠ የግንባታ እድሳት ፍቃድ" updated.	{"activityId": 141}	info	f	2025-11-12 21:41:50.852642+03
152	1	activity_updated	Activity "የተመዘገቡና ደረጃ የወጣላቸው የኮንስትራክሽን ፕሮጀክቶች" updated.	{"activityId": 142}	info	f	2025-11-12 21:42:26.739972+03
153	1	activity_updated	Activity "ለሥራ ተቋራጩች፣ለአማካሪዎች፣ባለሙያዎች፣መሳሪያ አከራዮችና ግብአት አምራቾች የተደረገ ምዝገባ ፍቃድ" updated.	{"activityId": 143}	info	f	2025-11-12 21:42:49.040934+03
154	1	activity_updated	Activity "የወቅታዊ የግንበታ ገበያ ዋጋ ጥናት ማድረግ" updated.	{"activityId": 144}	info	f	2025-11-12 21:43:12.398113+03
155	1	activity_updated	Activity "በክልሉ የነጠላ ግመታ መረጃ በማደራጀት (ለንብረት ዝውውር፤ ለካሳ እና ለባንክ እዳና እገዳ) አገልግሎት እንዲውል ማድረግ" updated.	{"activityId": 145}	info	f	2025-11-12 21:43:49.443402+03
156	1	activity_updated	Activity "4 የኮንስትራክሽን መሪ መዛኞችን በማፍራት 100 አነስተኛ እና መለስተኛ ባለሙያዎች ብቃታቸው በምዘና እንዲረጋገጥ ይደረጋል፡፡" updated.	{"activityId": 146}	info	f	2025-11-12 21:44:05.696979+03
157	1	activity_updated	Activity "No Name/ስም የለም/Tihariho eiziina" updated.	{"activityId": 147}	info	f	2025-11-12 21:44:39.133245+03
158	1	activity_updated	Activity "የህንፃ፣የመንገድ ዳር እና የውጭ ማስታወቂያ ፈቃድ መስጠት (አዲስ እና ነባር)" updated.	{"activityId": 148}	info	f	2025-11-12 21:45:09.437344+03
159	1	activity_updated	Activity "የማስታወቂያ ተከላ ክትትልና ቁጥጥር ማድረግ" updated.	{"activityId": 149}	info	f	2025-11-12 21:45:28.024006+03
160	1	activity_updated	Activity "የተሰጠ የግንባታ እርከን ማሳወቂያ" updated.	{"activityId": 150}	info	f	2025-11-12 21:46:04.024605+03
161	1	activity_updated	Activity "የተሰጠ የግንባታ ግብአት ጥራት ማረጋገጫ ማስረጃ" updated.	{"activityId": 151}	info	f	2025-11-12 21:46:26.376156+03
162	1	activity_updated	Activity "ተጀምረው ያልተጠናቀቁ እና አዲስ ግንባታ ፕሮጀክቶች ክትትልና ቁጥጥር ማድረግ" updated.	{"activityId": 152}	info	f	2025-11-12 21:46:56.911175+03
163	1	activity_updated	Activity "የማስተካከያ ትዕዛዝ የተሰጠባቸዉና የተስተካከሉ ፕሮጀክቶች" updated.	{"activityId": 153}	info	f	2025-11-12 21:47:20.111238+03
164	1	activity_updated	Activity "በከፊል ለተጠናቀቁ ህንጻዎች የተሰጠ መጠቀሚያ ፍቃድ" updated.	{"activityId": 154}	info	f	2025-11-12 21:47:47.231115+03
165	1	activity_updated	Activity "ሙለ ለሙለ ለተጠናቀቁ ሕንፃዎች የተሰጠ መጠቀሚያ ፍቃድ የመንግስት አገልግሎት መስጫ ተቋማትን ጨምሮ" updated.	{"activityId": 155}	info	f	2025-11-12 21:48:08.121459+03
166	1	activity_updated	Activity "ክትትልና ቁጥጥር የተደረገባቸዉ ግንባታ ፕሮጀክቶች ሽፋን ማሳደግ" updated.	{"activityId": 156}	info	f	2025-11-12 21:48:33.622171+03
167	1	activity_updated	Activity "ለቀረቡ የመረጃ ጥያቄዎች የተሰጡ ምላሾች" updated.	{"activityId": 157}	info	f	2025-11-12 21:49:07.326501+03
168	1	activity_updated	Activity "ግንባታ ነክ መረጃ ማደራጀት" updated.	{"activityId": 158}	info	f	2025-11-12 21:49:24.002024+03
169	1	activity_updated	Activity "ዲጅታላይዝ የተደረገ የመረጃ ቋት" updated.	{"activityId": 159}	info	f	2025-11-12 21:50:07.907013+03
170	1	activity_updated	Activity "በኤላክትሮኒክስ ተደራሽ የሆነ አገልግሎት" updated.	{"activityId": 160}	info	f	2025-11-12 21:50:25.204714+03
171	1	activity_updated	Activity "ለመኖሪያ ቤት ግንባታ የሚሆን 10 ሄክታር የለማ መሬት እንዲዘጋጅ ማድረግ" updated.	{"activityId": 161}	info	f	2025-11-12 22:07:48.87569+03
172	1	activity_updated	Activity "ለመኖሪያ ቤት ግንባታ የሚሆን የግንባታ ስምምነት ፍቃድ እንዲያገኙ ማድረግ" updated.	{"activityId": 162}	info	f	2025-11-12 22:08:12.461483+03
173	1	activity_updated	Activity "በገጠር የልማት ማዕከላት ደረጃቸውን ጠብቀው የተገነቡ ቤቶች" updated.	{"activityId": 163}	info	f	2025-11-12 22:08:38.084721+03
174	1	activity_updated	Activity "በዘመናዊ መረጃ ስርዓት የመንግስት ቤት መረጃ መያዝ" updated.	{"activityId": 164}	info	f	2025-11-12 22:09:24.901122+03
175	1	activity_updated	Activity "በመንግስት አስተባባሪነት በኪራይ ወይም በባለቤትነት (ዝቅተኛ ገቢ ላላቸው ህብረተሰብ ክፍሎች/አፓርታማ) ቤቶች እንዲገነቡ ማድረግ" updated.	{"activityId": 165}	info	f	2025-11-12 22:09:53.733245+03
176	1	activity_updated	Activity "በመንግስት አስተባባሪነት ለሚገነቡ ቤቶች 50 ሚሊዮን ብር አንዲቀርብ ማድረግ" updated.	{"activityId": 166}	info	f	2025-11-12 22:10:40.528235+03
177	1	activity_updated	Activity "በመንግስት አስተባባሪነት ለሚገነቡ ቤቶች 50 ሚሊዮን ብር አንዲቀርብ ማድረግ" updated.	{"activityId": 166}	info	f	2025-11-12 22:11:07.424698+03
178	1	activity_updated	Activity "በመንግስት አስተባባሪነት የተገነቡ ቤቶች እንዲተላለፉ ማድረግ" updated.	{"activityId": 167}	info	f	2025-11-12 22:12:08.586675+03
179	1	activity_updated	Activity "በመንግስት አስተባባሪነት የተገነቡ ቤቶች እንዲተላለፉ ማድረግ" updated.	{"activityId": 167}	info	f	2025-11-12 22:12:45.298062+03
180	1	activity_updated	Activity "ከ100/0 ቤቶች ቀሪ ክፍያ የሚሰበሰብ ገቢ (በግሉ ዘርፍ ለሚገነቡ ቤቶች አንዲቀርብ ማድረግ)" updated.	{"activityId": 168}	info	f	2025-11-12 22:14:27.669012+03
181	1	activity_updated	Activity "ከመምህራን ቤት ወርሃዊ ክፍያ የሚሰበሰበ ገቢ" updated.	{"activityId": 169}	info	f	2025-11-12 22:17:01.534535+03
182	1	activity_updated	Activity "በመኖሪያ ቤት ህብረት ሥራ ማኀበራት የቤት ልማት አቅርቦት ፕሮግራም ቤቶች እንዲገነቡ ማድረግ" updated.	{"activityId": 171}	info	f	2025-11-12 22:19:07.136018+03
183	1	activity_updated	Activity "የአፓርታማ ቤት ግንባታ የሚሰበሰብ ገንዘብ" updated.	{"activityId": 170}	info	f	2025-11-12 22:20:04.413358+03
184	1	activity_updated	Activity "በግለሰቦች የቤት ልማት አቅርቦት ፕሮግራም ቤቶች እንዲገነቡ ማድረግ" updated.	{"activityId": 172}	info	f	2025-11-12 22:20:47.386353+03
185	1	activity_updated	Activity "በሪል ስቴት የቤት ልማት አቅርቦት ፕሮግራም 50 ቤቶች መገንባት" updated.	{"activityId": 173}	info	f	2025-11-12 22:21:20.385194+03
186	1	activity_updated	Activity "በባለሀብቶች ቅይጥ ህንፃ የሚገነቡ ቤቶች (መረጃ ከከተማ ልማት የሚሰበሰብ)" updated.	{"activityId": 174}	info	f	2025-11-12 22:21:47.285297+03
187	1	activity_updated	Activity "በመልሶ ማልማት ቤቶች እንዲገነቡ ማድረግ" updated.	{"activityId": 175}	info	f	2025-11-12 22:22:22.482124+03
188	1	activity_updated	Activity "በማሻሻያ (በእድሳት) ልማት ደረጃቸው እንዲሻሻል ማድረግ" updated.	{"activityId": 176}	info	f	2025-11-12 22:22:47.306177+03
189	1	activity_updated	Activity "የፕሮጀክት ሙሉ ዲዛይኖች ማዘጋጀት" updated.	{"activityId": 177}	info	f	2025-11-12 22:23:16.087112+03
190	1	activity_updated	Activity "የፕሮጀክት BOQ እና ነጠላ ዋጋ ግምት ማዘጋጃት" updated.	{"activityId": 178}	info	f	2025-11-12 22:23:38.573477+03
191	1	activity_updated	Activity "ባለቤት መስሪያ ቤቶች የፕሮጀክቶቻቸውን ዲዛይን እንዲያጸድቁ ተዘጋጅቶ የተላከላቸው የፕሮጀክታቸው ዲዛይኖች" updated.	{"activityId": 179}	info	f	2025-11-12 22:25:14.854524+03
192	1	activity_updated	Activity "ለመኖ/ህ/ስ/ማህበራት እና ለገጠር ቤቶች ልማት   ስታንዳርድ ዲዛይኖች ማዘጋጀት" updated.	{"activityId": 180}	info	f	2025-11-12 22:26:19.829014+03
193	1	activity_updated	Activity "ለመኖ/ህ/ስ/ማህበራት እና ለገጠር ቤቶች ልማት   ስታንዳርድ ዲዛይኖች ማዘጋጀት" updated.	{"activityId": 181}	info	f	2025-11-12 22:26:59.722538+03
194	1	activity_updated	Activity "የተጠናቀቀ የጨረታ ሒደት" updated.	{"activityId": 182}	info	f	2025-11-12 22:27:34.826546+03
195	1	activity_updated	Activity "በጨረታ ሰነድ መሰረት የሚታሰሩ ውሎች" updated.	{"activityId": 183}	info	f	2025-11-12 22:27:52.616827+03
196	1	activity_created	Activity "የተዘጋጀ የጨረታ ሰነድ" created.	{"activityId": 205}	info	f	2025-11-12 22:31:17.206496+03
197	1	activity_updated	Activity "የተጠናቀቀ የጨረታ ሒደት" updated.	{"activityId": 182}	info	f	2025-11-12 22:35:59.387554+03
198	1	activity_updated	Activity "የተዘጋጀ የጨረታ ሰነድ" updated.	{"activityId": 205}	info	f	2025-11-12 22:36:07.662514+03
199	1	activity_deleted	Activity "በተያዘላቸዉ ጊዜ፣ በጀትና ጥራት የሚጠናቀቁ ፕሮጀክቶች ብዛት" deleted.	{"activityId": 186}	info	f	2025-11-12 22:36:36.225363+03
200	1	activity_updated	Activity "በተያዘላቸዉ ጊዜ፣ በጀትና ጥራት የሚጠናቀቁ ፕሮጀክቶች ብዛት" updated.	{"activityId": 185}	info	f	2025-11-12 22:37:05.9325+03
201	1	activity_updated	Activity "ክትትልና ቁጥጥር የሚደረግባቸው ፕሮጀክቶች" updated.	{"activityId": 184}	info	f	2025-11-12 22:37:15.934888+03
202	1	activity_updated	Activity "በጨረታ ሰነድ መሰረት የሚታሰሩ ውሎች" updated.	{"activityId": 183}	info	f	2025-11-12 22:37:29.75951+03
203	1	activity_updated	Activity "የተጠናቀቀ የጨረታ ሒደት" updated.	{"activityId": 182}	info	f	2025-11-12 22:37:38.426911+03
204	1	activity_created	Activity "በፕሮጀክቶች ግንባታ ቋሚና የሥራ ዕድል የሚፈጠርላቸው ሰዎች" created.	{"activityId": 206}	info	f	2025-11-12 22:39:14.342054+03
205	1	activity_created	Activity "በቤቶች ልማትና በመንግስት ኮንስትራክሽን ዙሪያ የሚደረጉ ጥናቶች" created.	{"activityId": 207}	info	f	2025-11-12 22:40:08.566271+03
206	1	activity_created	Activity "በተያዘላቸዉ ጊዜ፣ በጀትና ጥራት የተጠናቀቁ ፕሮጀክቶች ሽፋን ማሳደግ" created.	{"activityId": 208}	info	f	2025-11-12 22:40:48.797441+03
207	1	activity_created	Activity "የኮንስትራክሽን የላቦራቶሪ አገልግሎት መስጠት" created.	{"activityId": 209}	info	f	2025-11-12 22:42:31.545664+03
208	1	activity_created	Activity "ከተሰጡ የኮንስትራክሽን የላቦራቶሪ አገልግሎቶችን የተገኘ ገቢ" created.	{"activityId": 210}	info	f	2025-11-12 22:47:38.699205+03
209	1	activity_updated	Activity "በመኖሪያ ቤቶች ቆጠራ (Inventory) ወቅት የተገኙ ግኝቶችን መፍትሄ መስጠት" updated.	{"activityId": 188}	info	f	2025-11-12 22:48:47.029277+03
210	1	activity_updated	Activity "ኤጀንሲው የሚያስተዳድራቸውን ኮንዶምኒየም ቤቶች አመታዊ ቆጠራ ማድረግ" updated.	{"activityId": 189}	info	f	2025-11-12 22:49:24.499112+03
211	1	activity_updated	Activity "ኤጀንሲው የሚያስተዳድራቸውን ንግድ ቤቶች አመታዊ ቆጠራ ማድረግ" updated.	{"activityId": 190}	info	f	2025-11-12 22:50:03.527249+03
212	1	activity_updated	Activity "መኖሪያ ቤቶች፣ መንግስታዊና መንግታዊ ያልሆኑ ተቋም ኪራይ ተመን ማሻሻያ ጥናት አስወስኖ ወደ ትግበራ መግባት" updated.	{"activityId": 191}	info	f	2025-11-12 22:51:02.811428+03
213	1	activity_updated	Activity "ነባር መመሪያን አሻሽሎ ለቦርድ በማቅረብ ማስወሰን" updated.	{"activityId": 192}	info	f	2025-11-12 22:51:51.822797+03
214	1	activity_updated	Activity "ተከራይ ደንበኛ አዲስ የተሻሻለውን ውል እንዲሞሉ ማድረግ" updated.	{"activityId": 193}	info	f	2025-11-12 22:53:05.783995+03
215	1	activity_updated	Activity "በይዞታዎቻችን ላይ ሊፈጸሙ የሚችሉትን ህገ-ወጥ ድርጊቶችን ክትትል ማድረግ" updated.	{"activityId": 194}	info	f	2025-11-12 22:53:43.957506+03
216	1	activity_updated	Activity "ኤጃንሲው ከሚያስተዳድራቸው ቤቶች አመታዊ ገቢ መሰብሰብ" updated.	{"activityId": 195}	info	f	2025-11-12 22:55:22.375761+03
217	1	activity_updated	Activity "ሁለት የክፍያ አማራጭ ስርዓትን በመዘርጋት አሰራርን ማዘመን" updated.	{"activityId": 196}	info	f	2025-11-12 22:55:52.03483+03
218	1	activity_updated	Activity "ለቦርድ ቀርቦ የሚፀድቀውን የመኖሪያ ቤቶችን የሽያጭ ማስተላለፍ ጥናትን ተግባራዊ ማድረግ" updated.	{"activityId": 197}	info	f	2025-11-12 22:57:02.414836+03
219	1	activity_updated	Activity "ከባለሀብቶች ጋር በመጣመር በኤጀንሲው ይዞታ ላይ ቅይጥ አገልግሎት የሚሰጡ ህንፃዎችን መገንባት" updated.	{"activityId": 198}	info	f	2025-11-12 22:57:37.989035+03
220	1	activity_updated	Activity "በኤጀንሲው ይዞታ ላይ B+G+4 የጋራ መኖሪያ ኮንዶሚኒየም ህንጻ መገንባት" updated.	{"activityId": 199}	info	f	2025-11-12 22:57:53.48881+03
221	1	activity_updated	Activity "መኖሪያ ቤቶችን ለተከራይ ደንበኞች በሽያጭ ለማስተላለፍ የተሰራውን ጥናት ለቦርድ አቅርቦ ማፀደቅ" updated.	{"activityId": 200}	info	f	2025-11-12 22:58:55.381639+03
222	1	activity_updated	Activity "የቀድሞ ሲቪል ሰርቪስ ቢሮ ምድር ላይ ያሉትን አራት የፅ/ቤት ክፍሎችን ወደ ንግድ ቤት መቀየር" updated.	{"activityId": 201}	info	f	2025-11-12 22:59:20.7238+03
223	1	activity_updated	Activity "ለወሳኝ ኩነት ቢሮ አጥርና ቢሮ መገንባት" updated.	{"activityId": 202}	info	f	2025-11-12 22:59:48.192106+03
224	1	activity_updated	Activity "ለምናስተዳድራቸው ቤቶች ጥገና እና እድሳት ማድረግ" updated.	{"activityId": 203}	info	f	2025-11-12 23:00:13.038637+03
225	1	activity_updated	Activity "ለምናስተዳድራቸው ቤቶች የይዞታ ማረጋገጫ ካርታ እንዲኖራቸው ማድረግ" updated.	{"activityId": 204}	info	f	2025-11-12 23:00:32.7823+03
226	1	activity_updated	Activity "የተጠሪ ተቋማት ዕቅድን ከዘርፍ ዕቅድ ጋር ማናበብና ማጣጣም" updated.	{"activityId": 34}	info	f	2025-11-12 23:02:44.010212+03
227	1	activity_created	Activity "ለተጠሪ ተቋማት እና ለወረዳ ወቅታዊ የአቅም ግንባታ ድጋፍ መስጠት" created.	{"activityId": 211}	info	f	2025-11-12 23:03:23.125895+03
228	1	activity_updated	Activity "የተጠሪ ተቋማት ዕቅድን ከዘርፍ ዕቅድ ጋር ማናበብና ማጣጣም" updated.	{"activityId": 34}	info	f	2025-11-12 23:10:16.399309+03
229	1	activity_updated	Activity "ለተጠሪ ተቋማት እና ለወረዳ ወቅታዊ የአቅም ግንባታ ድጋፍ መስጠት" updated.	{"activityId": 211}	info	f	2025-11-12 23:10:46.603968+03
230	1	activity_updated	Activity "የተጠሪ ተቋማት ዕቅድን ከዘርፍ ዕቅድ ጋር ማናበብና ማጣጣም" updated.	{"activityId": 34}	info	f	2025-11-12 23:10:55.407533+03
231	1	activity_updated	Activity "ለተጠሪ ተቋማት እና ለወረዳ ወቅታዊ የአቅም ግንባታ ድጋፍ መስጠት" updated.	{"activityId": 211}	info	f	2025-11-12 23:11:21.210152+03
232	1	attachment_uploaded	Attachment "397324 (1) (1).jpg" uploaded.	{"reportId": 1, "attachmentId": 1}	info	f	2025-11-15 22:40:45.641985+03
236	1	group_removed	You were removed from a group (id: 1).	{"groupId": 1}	info	t	2025-11-15 23:31:36.49202+03
234	1	group_added	You were added to a group (id: 1).	{"groupId": 1}	info	t	2025-11-15 23:31:28.296829+03
\.


--
-- Data for Name: Permissions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Permissions" (id, name, description, "createdAt", "updatedAt") FROM stdin;
1	manage_gta	manage_gta permission	2025-11-11 14:51:59.931902+03	2025-11-11 14:51:59.931902+03
2	view_gta	view_gta permission	2025-11-11 14:51:59.931902+03	2025-11-11 14:51:59.931902+03
3	submit_reports	submit_reports permission	2025-11-11 14:51:59.931902+03	2025-11-11 14:51:59.931902+03
4	view_reports	view_reports permission	2025-11-11 14:51:59.931902+03	2025-11-11 14:51:59.931902+03
5	manage_reports	manage_reports permission	2025-11-11 14:51:59.931902+03	2025-11-11 14:51:59.931902+03
6	manage_settings	manage_settings permission	2025-11-11 14:51:59.931902+03	2025-11-11 14:51:59.931902+03
7	view_audit_logs	view_audit_logs permission	2025-11-11 14:51:59.931902+03	2025-11-11 14:51:59.931902+03
8	manage_notifications	manage_notifications permission	2025-11-11 14:51:59.931902+03	2025-11-11 14:51:59.931902+03
9	manage_dashboard	manage_dashboard permission	2025-11-11 14:51:59.931902+03	2025-11-11 14:51:59.931902+03
10	view_dashboard	view_dashboard permission	2025-11-11 14:51:59.931902+03	2025-11-11 14:51:59.931902+03
11	manage_attachments	manage_attachments permission	2025-11-11 14:51:59.931902+03	2025-11-11 14:51:59.931902+03
12	manage_access	manage_access permission	2025-11-11 14:51:59.931902+03	2025-11-11 14:51:59.931902+03
\.


--
-- Data for Name: ProgressHistory; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ProgressHistory" (id, entity_type, entity_id, group_id, progress, metrics, recorded_at, snapshot_month) FROM stdin;
1	Activity	32	4	0	{"targetMetric": {"በብር": "100,000"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
2	Activity	33	4	0	{"targetMetric": {"በመቶኛ": "100"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
3	Activity	34	4	0	{"targetMetric": {"በሰነድ": "6"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
4	Activity	36	4	0	{"targetMetric": {"በሰነድ": "1"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
5	Activity	35	4	0	{"targetMetric": {"በቁጥር": "4"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
6	Activity	5	4	0	{"targetMetric": {"በቁጥር": "5"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
7	Activity	6	4	0	{"targetMetric": {"በሰነድ": "14"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
8	Activity	7	4	0	{"targetMetric": {"በሰነድ": "6"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
9	Activity	8	4	0	{"targetMetric": {"በመቶኛ": "100"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
10	Activity	9	4	0	{"targetMetric": {"በመቶኛ": "100"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
11	Activity	10	4	0	{"targetMetric": {"በቁጥር": "200"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
12	Activity	11	4	0	{"targetMetric": {"በጊዜ": "1"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
13	Activity	12	4	0	{"targetMetric": {"በመቶኛ": "60"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
14	Activity	13	4	0	{"targetMetric": {"በመቶኛ": "0"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
15	Activity	14	4	0	{"targetMetric": {"በመቶኛ": "100"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
16	Activity	15	4	0	{"targetMetric": {"በሰነድ": "12"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
17	Activity	16	4	0	{"targetMetric": {"በሰነድ": "1"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
18	Activity	17	4	0	{"targetMetric": {"በሰነድ": "1"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
19	Activity	19	4	0	{"targetMetric": {"በመቶኛ": "87"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
20	Activity	18	4	0	{"targetMetric": {"በሰነድ": "2"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
21	Activity	20	4	0	{"targetMetric": {"በሰነድ": "4"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
22	Activity	21	4	0	{"targetMetric": {"በቁጥር": "0"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
23	Activity	22	4	0	{"targetMetric": {"በብር": "0"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
24	Activity	23	4	0	{"targetMetric": {"በመቶኛ": "100"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
25	Activity	24	4	0	{"targetMetric": {"በሰነድ": "1"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
26	Activity	25	4	0	{"targetMetric": {"በሰነድ": "1"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
27	Activity	26	4	0	{"targetMetric": {"በቁጥር": "10"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
28	Activity	27	4	0	{"targetMetric": {"በመቶኛ": "100"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
29	Activity	28	4	0	{"targetMetric": {"በመቶኛ": "80"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
30	Activity	29	4	0	{"targetMetric": {"በመቶኛ": "80"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
31	Activity	30	4	0	{"targetMetric": {"በመቶኛ": "100"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
32	Activity	31	4	0	{"targetMetric": {"በብር": "1,000,000"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
33	Activity	37	4	0	{"targetMetric": {"በሰነድ": "9"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
34	Activity	38	4	0	{"targetMetric": {"በቁጥር": "4"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
35	Activity	39	4	0	{"targetMetric": {"በመቶኛ": "100"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
36	Activity	40	4	0	{"targetMetric": {"በቁጥር": "1"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
37	Activity	75	5	0	{"targetMetric": {"በሰነድ": "1"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
38	Activity	41	4	0	{"targetMetric": {"በመቶኛ": "75"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
39	Activity	42	4	0	{"targetMetric": {"በቁጥር": "100"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
40	Activity	43	4	0	{"targetMetric": {"በቁጥር": "10"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
41	Activity	44	4	0	{"targetMetric": {"በመቶኛ": "50"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
42	Activity	45	4	0	{"targetMetric": {"በመቶኛ": "100"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
43	Activity	46	4	0	{"targetMetric": {"በመቶኛ": "100"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
44	Activity	47	4	0	{"targetMetric": {"በቁጥር": "1602"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
45	Activity	48	4	0	{"targetMetric": {"በቁጥር": "1602"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
46	Activity	49	4	0	{"targetMetric": {"በቁጥር": "1602"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
47	Activity	51	4	0	{"targetMetric": {"በቁጥር": "4"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
48	Activity	52	4	0	{"targetMetric": {"በብር": "1.5ሚ"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
49	Activity	53	4	0	{"targetMetric": {"በብር": "400ሺ"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
50	Activity	50	4	0	{"targetMetric": {"በቁጥር": "1361"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
51	Activity	54	4	0	{"targetMetric": {"በብር": "400ሺ"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
52	Activity	55	4	0	{"targetMetric": {"ዩኒት": "30"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
53	Activity	56	4	0	{"targetMetric": {"በቁጥር": "10"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
54	Activity	57	4	0	{"targetMetric": {"በብር": "20,000"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
55	Activity	58	5	0	{"targetMetric": {"በሰነድ": "12"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
56	Activity	59	5	0	{"targetMetric": {"በቁጥር": "4"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
57	Activity	60	5	0	{"targetMetric": {"በቁጥር": "4"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
58	Activity	61	5	0	{"targetMetric": {"በሰነድ": "2"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
59	Activity	62	5	0	{"targetMetric": {"በሰነድ": "1"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
60	Activity	63	5	0	{"targetMetric": {"በሰነድ": "1"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
61	Activity	64	5	0	{"targetMetric": {"በሰነድ": "1"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
62	Activity	65	5	0	{"targetMetric": {"በመቶኛ": "80"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
63	Activity	66	5	0	{"targetMetric": {"በመቶኛ": "80"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
64	Activity	67	5	0	{"targetMetric": {"በመቶኛ": "55"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
65	Activity	68	5	0	{"targetMetric": {"በሰነድ": "2"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
66	Activity	69	5	0	{"targetMetric": {"በሰነድ": "6"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
67	Activity	70	5	0	{"targetMetric": {"በመድረክ": "2"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
68	Activity	71	5	0	{"targetMetric": {"በሰነድ": "1"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
69	Activity	72	5	0	{"targetMetric": {"በሰልጣኝ በቁጥር": "20"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
70	Activity	73	5	0	{"targetMetric": {"በሰነድ": "1"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
71	Activity	74	5	0	{"targetMetric": {"በሰነድ": "2"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
72	Activity	76	5	0	{"targetMetric": {"በሰነድ": "2"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
73	Activity	77	5	0	{"targetMetric": {"በሰነድ": "2"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
74	Activity	78	5	0	{"targetMetric": {"በሰነድ": "4"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
75	Activity	82	5	0	{"targetMetric": {"በሰነድ": "1"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
76	Activity	79	5	0	{"targetMetric": {"በሰነድ": "2"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
77	Activity	80	5	0	{"targetMetric": {"በሰነድ": "1"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
78	Activity	81	5	0	{"targetMetric": {"በመቶኛ": "100"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
79	Activity	85	5	0	{"targetMetric": {"በቁጥር": "3"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
80	Activity	86	5	0	{"targetMetric": {"በሰነድ": "1"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
81	Activity	87	5	0	{"targetMetric": {"በሰነድ": "1"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
82	Activity	83	5	0	{"targetMetric": {"በመድረክ": "2"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
83	Activity	84	5	0	{"targetMetric": {"በሰነድ": "1"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
84	Activity	88	9	0	{"targetMetric": {"ሰነድ": "1"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
85	Activity	89	9	0	{"targetMetric": {"በሄክታር": "50"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
86	Activity	90	9	0	{"targetMetric": {"በሄክታር": "50"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
87	Activity	91	9	0	{"targetMetric": {"በሰነድ": "1"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
88	Activity	92	9	0	{"targetMetric": {"በሄክታር": "50"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
89	Activity	93	9	0	{"targetMetric": {"በሄክታር": "14"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
90	Activity	94	9	0	{"targetMetric": {"በሄክታር": "5"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
91	Activity	95	9	0	{"targetMetric": {"በሄክታር": "9"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
92	Activity	96	9	0	{"targetMetric": {"በሄክታር": "4"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
93	Activity	97	9	0	{"targetMetric": {"በሄክታር": "6"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
94	Activity	98	9	0	{"targetMetric": {"በሄክታር": "6"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
95	Activity	99	9	0	{"targetMetric": {"በሄክታር": "2"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
96	Activity	100	9	0	{"targetMetric": {"በሄክታር": "4"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
97	Activity	101	9	0	{"targetMetric": {"በቁጥር": "8,000"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
98	Activity	102	9	0	{"targetMetric": {"በሄክታር": "1"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
99	Activity	103	9	0	{"targetMetric": {"በቁጥር": "4,500"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
100	Activity	104	9	0	{"targetMetric": {"በቁጥር": "1,000"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
101	Activity	105	9	0	{"targetMetric": {"በቁራሽ መሬት ብዛት": "5,000"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
102	Activity	106	9	0	{"targetMetric": {"በሄክታር": "10"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
103	Activity	107	9	0	{"targetMetric": {"በብር": "500,000,000"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
104	Activity	118	6	0	{"targetMetric": {"የተዘጋጀ ሰነድ": "13"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
105	Activity	108	9	0	{"targetMetric": {"በብር": "200,000,000"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
106	Activity	109	9	0	{"targetMetric": {"በቁጥር": "12,500"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
107	Activity	110	9	0	{"targetMetric": {"በቁጥር": "15,000"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
108	Activity	111	6	0	{"targetMetric": {"የስፔስፊኬሽን ሰነድ": "1"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
109	Activity	112	6	0	{"targetMetric": {"በቀጠና ብዛት": "4"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
110	Activity	113	6	0	{"targetMetric": {"በሰነድ": "1"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
111	Activity	114	6	0	{"targetMetric": {"በተረከበ ፋይል ቁጥር": "15,000"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
112	Activity	115	6	0	{"targetMetric": {"በመድረክ": "3"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
113	Activity	116	6	0	{"targetMetric": {"በመድረክ": "4"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
114	Activity	117	6	0	{"targetMetric": {"በቁራሽ መሬት በቁጥር": "15,000"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
115	Activity	119	6	0	{"targetMetric": {"በቁራሽ መሬት በቁጥር": "15,000"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
116	Activity	120	6	0	{"targetMetric": {"በቁራሽ መሬት በቁጥር": "15,000"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
117	Activity	121	6	0	{"targetMetric": {"በቁራሽ መሬት በቁጥር": "15,000"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
118	Activity	122	6	0	{"targetMetric": {"በይዞታ ቁጥር": "15,000"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
119	Activity	123	6	0	{"targetMetric": {"የይዞታ ማረጋገጫ ካርታ በቁጥር": "15,000"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
120	Activity	124	6	0	{"targetMetric": {"በከተማ ቁጥር": "1"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
121	Activity	125	6	0	{"targetMetric": {"አገልግሎት ያገኙ ባለይዞታዎች በቁጥር": "6000"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
122	Activity	126	6	0	{"targetMetric": {"በቁጥር": "6,500"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
123	Activity	127	6	0	{"targetMetric": {"በቁጥር": "6,000"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
124	Activity	128	6	0	{"targetMetric": {"በቁጥር": "6,000"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
125	Activity	129	6	0	{"targetMetric": {"በብር": "10,000,000"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
126	Activity	130	6	0	{"targetMetric": {"በመቶኛ": "60"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
127	Activity	131	6	0	{"targetMetric": {"በሰነድ": "2"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
128	Activity	132	6	0	{"targetMetric": {"በብር": "200,000,000"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
129	Activity	133	6	0	{"targetMetric": {"በመቶኛ": "70"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
130	Activity	134	6	0	{"targetMetric": {"በቄጥር": "1"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
131	Activity	135	6	0	{"targetMetric": {"በቄጥር": "1"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
132	Activity	136	6	0	{"targetMetric": {"በቄጥር": "1"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
133	Activity	141	7	0	{"targetMetric": {"በቁጥር": "355"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
134	Activity	137	7	0	{"targetMetric": {"በቁጥር": "1,600"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
135	Activity	138	7	0	{"targetMetric": {"በቁጥር": "1,200"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
136	Activity	139	7	0	{"targetMetric": {"በቁጥር": "15"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
137	Activity	140	7	0	{"targetMetric": {"በቁጥር": "30"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
138	Activity	142	7	0	{"targetMetric": {"በቁጥር": "80"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
139	Activity	143	7	0	{"targetMetric": {"በቁጥር": "100"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
140	Activity	144	7	0	{"targetMetric": {"በሰነድ": "4"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
141	Activity	146	7	0	{"targetMetric": {"መሪ መዛኝ በቁጥር": "4"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
142	Activity	145	7	0	{"targetMetric": {"በሰነድ": "1"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
143	Activity	147	7	0	{"targetMetric": {"በምዘና የተረጋገጠ ባለሙያ በቁጥር": "100"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
144	Activity	148	7	0	{"targetMetric": {"በቁጥር": "150"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
145	Activity	149	7	0	{"targetMetric": {"በቁጥር": "150"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
146	Activity	150	7	0	{"targetMetric": {"በቁጥር": "142"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
147	Activity	151	7	0	{"targetMetric": {"በቁጥር": "154"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
148	Activity	152	7	0	{"targetMetric": {"በፕሮጀክት ቁጥር": "154"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
149	Activity	153	7	0	{"targetMetric": {"በቁጥር": "100"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
150	Activity	154	7	0	{"targetMetric": {"በቁጥር": "30"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
151	Activity	155	7	0	{"targetMetric": {"በቁጥር": "15"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
152	Activity	156	7	0	{"targetMetric": {"በመቶኛ": "100"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
153	Activity	157	7	0	{"targetMetric": {"በመቶኛ": "100"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
154	Activity	158	7	0	{"targetMetric": {"በሰነድ": "1"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
155	Activity	159	7	0	{"targetMetric": {"በመቶኛ": "100"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
156	Activity	160	7	0	{"targetMetric": {"በመቶኛ": "50"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
157	Activity	162	8	0	{"targetMetric": {"በቁጥር": "12"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
158	Activity	163	8	0	{"targetMetric": {"በቁጥር": "90"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
159	Activity	164	8	0	{"targetMetric": {"በቁጥር": "1,000"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
160	Activity	165	8	0	{"targetMetric": {"በቁጥር": "200"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
161	Activity	166	8	0	{"targetMetric": {"በሚሊዮን ብር": "50"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
162	Activity	167	8	0	{"targetMetric": {"none/ባዶ/busha": "6"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
163	Activity	168	8	0	{"targetMetric": {"በብር": "20,000,000"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
164	Activity	169	8	0	{"targetMetric": {"በብር": "1,750,000"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
165	Activity	170	8	0	{"targetMetric": {"በብር": "30,000,000"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
166	Activity	171	8	0	{"targetMetric": {"በቁጥር": "120"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
167	Activity	172	8	0	{"targetMetric": {"በቁጥር": "1,200"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
168	Activity	173	8	0	{"targetMetric": {"በቁጥር": "50"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
169	Activity	174	8	0	{"targetMetric": {"በቁጥር": "50"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
170	Activity	175	8	0	{"targetMetric": {"በቁጥር": "230"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
171	Activity	176	8	0	{"targetMetric": {"በቁጥር": "300"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
172	Activity	177	8	0	{"targetMetric": {"በቁጥር": "12"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
173	Activity	178	8	0	{"targetMetric": {"በቁጥር": "10"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
174	Activity	179	8	0	{"targetMetric": {"በቁጥር": "9"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
175	Activity	180	8	0	{"targetMetric": {"ለከተማ በማህበራት የተዘጋጀ ዲዛይን በቁጥር": "1"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
176	Activity	181	8	0	{"targetMetric": {"ለገጠር ቤቶች የተዘጋጀ ዲዛይን በቁጥር": "1"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
177	Activity	182	8	0	{"targetMetric": {"በቁጥር": "9"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
178	Activity	183	8	0	{"targetMetric": {"በቁጥር": "9"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
179	Activity	184	8	0	{"targetMetric": {"በቁጥር": "22"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
180	Activity	185	8	0	{"targetMetric": {"በቁጥር": "12"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
181	Activity	186	8	0	{"targetMetric": {"በቁጥር": "12"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
182	Activity	187	8	0	{"targetMetric": {"በቁጥር": "15"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
183	Activity	161	8	0	{"targetMetric": {"በሄክታር": "10"}, "currentMetric": {"ahdg": "ukweh"}}	2025-11-11 15:04:08.67263+03	2025-11-01
184	Activity	188	10	0	{"targetMetric": {"በቁጥር": "3"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
185	Activity	191	10	0	{"targetMetric": {"በሰነድ": "2"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
186	Activity	192	10	0	{"targetMetric": {"በሰነድ": "1"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
187	Activity	195	10	0	{"targetMetric": {"በብር": "18745715"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
188	Activity	198	10	0	{"targetMetric": {"በቁጥር": "3"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
189	Activity	199	10	0	{"targetMetric": {"በቁጥር": "1"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
190	Activity	202	10	0	{"targetMetric": {"በቁጥር": "1"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
191	Activity	189	10	0	{"targetMetric": {"በቁጥር": "166"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
192	Activity	193	10	0	{"targetMetric": {"በቁጥር": "1283"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
193	Activity	196	10	0	{"targetMetric": {"በክፍያ አማራጭ ብዛት": "2"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
194	Activity	200	10	0	{"targetMetric": {"በሰነድ": "1"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
195	Activity	203	10	0	{"targetMetric": {"በቁጥር": "20"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
196	Activity	190	10	0	{"targetMetric": {"በቁጥር": "343"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
197	Activity	194	10	0	{"targetMetric": {"በወር": "12"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
198	Activity	197	10	0	{"targetMetric": {"በቁጥር": "100"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
199	Activity	201	10	0	{"targetMetric": {"በቁጥር": "4"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
200	Activity	204	10	0	{"targetMetric": {"በቁጥር": "392"}, "currentMetric": {}}	2025-11-11 15:04:08.67263+03	2025-11-01
\.


--
-- Data for Name: RefreshTokens; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."RefreshTokens" (id, "userId", token_hash, "expiresAt", revoked, createdat) FROM stdin;
1	1	$2b$10$g8vD0pviIF5SNnul0SjLoOjHy7td4jZzVj4iWMijCvi8/pzqVkQwG	2025-11-12 15:05:41.587+03	t	2025-11-11 15:05:41.589296+03
2	1	$2b$10$Wnq5UjPNPXfQaqmDilKP0eSpOVZ/1e5yL31rlFHQG.YAo.zIOL1sG	2025-11-12 15:21:49.576+03	t	2025-11-11 15:21:49.580207+03
3	1	$2b$10$bpdkDSE1CMGbjlhXjY5wJep2BnOQySuwZ8AS/Jprcig2cDFCOCeVa	2025-11-12 15:37:34.78+03	t	2025-11-11 15:37:34.80254+03
4	1	$2b$10$CulkAW8iALIjI5205jqKTes1cGKzGYLaJ3rH8ey7qETQRTwrDHRuq	2025-11-12 15:53:05.184+03	t	2025-11-11 15:53:05.191855+03
5	1	$2b$10$SHH14UINXRSQjCqgE3wlxO2zk0zuZpqLjEXpmmAuaRt3hwoxd0GRu	2025-11-12 16:09:02.752+03	t	2025-11-11 16:09:02.791277+03
6	1	$2b$10$jdt3zVi46t6duQPoq3BxROXxyx0Urf3HfrsjMOhgBBB6cAyjWPYNS	2025-11-12 16:24:22.171+03	t	2025-11-11 16:24:22.183126+03
7	1	$2b$10$vAn2jbK9o2tzWVIPFkcbZ.iBmDpsS0p3rsmr1AhTIvWQqJ8./yZIW	2025-11-12 16:39:27.498+03	t	2025-11-11 16:39:27.515735+03
8	1	$2b$10$c/afbx2z6pXhiPWoTvLXqebLIuD50gFigRTGSCZnSedb5315rQjd.	2025-11-12 16:55:43.938+03	t	2025-11-11 16:55:43.948108+03
9	1	$2b$10$ZpigWePFqcXeLL0.wU7eHuZf7XM/Dc8c1VttmSLNoH0KTfmINugNq	2025-11-12 17:11:13.321+03	t	2025-11-11 17:11:13.326075+03
10	1	$2b$10$ZHeft8AcLm/vjvY6TzqP2.9KiYTk7qaFTGjxXpPQm/3vOO9U10Jre	2025-11-13 09:55:01.25+03	t	2025-11-12 09:55:01.492065+03
11	1	$2b$10$Cwam79OMaltwB6b2vF1qIOikD8D1G80aPalvZPL8wTJz5ZOdmSHSm	2025-11-13 16:41:27.396+03	t	2025-11-12 16:41:27.577549+03
12	1	$2b$10$gegz.FSxzfxYUi6Wj6LPBudAZkh19Tpw45Ep/C/WVJLWRNne4Nwz2	2025-11-13 21:29:33.334+03	t	2025-11-12 21:29:33.453225+03
13	1	$2b$10$a1iLzgitQijHs6vBAf4Dk.yOruNGuK4gj3j7uhvirkoCoZ7qqg0ZK	2025-11-13 21:44:39.019+03	t	2025-11-12 21:44:39.028535+03
14	1	$2b$10$4pEtmnXfd6zG9HekxTa3U.bskAQ6rwnBf2bjOCADw.WfHBNAhSJJa	2025-11-13 22:06:29.769+03	t	2025-11-12 22:06:29.775782+03
15	1	$2b$10$R9fOc.fYoeMUzUyRxqdkiO/ZTifIVHKuqH1sP3Q8rB5T.uL0Irq.e	2025-11-13 22:21:47.245+03	t	2025-11-12 22:21:47.248209+03
16	1	$2b$10$Wd2u1eBag./lJ1gIHknsNO6WCuOQnZW6OF3GKH/ArRJmsXB2j65C6	2025-11-13 22:37:05.882+03	t	2025-11-12 22:37:05.90449+03
17	1	$2b$10$RNnrD4KbvCrmvjgz3ZQQou8k4c9rXm1r0gH8GNq451Eb4oGtZSvz2	2025-11-13 22:53:05.702+03	t	2025-11-12 22:53:05.708749+03
18	1	$2b$10$79RkEJ7joyzcbV9o8fKvKurEZYmgX4TcskKpahyBtjcJcjmK4Hcza	2025-11-13 23:10:16.351+03	t	2025-11-12 23:10:16.354827+03
19	1	$2b$10$e8LO6FC6a20ve4tAdrQ.E.2HKJpAKN6IZvkDgc2/d1KFTXZg90KsC	2025-11-14 08:52:08.787+03	t	2025-11-13 08:52:08.833683+03
20	1	$2b$10$bwogcV/8JODgVESO2LTq.eaYfejqk1Vji0.OwsG34FHs3WG0Q.A2y	2025-11-14 11:29:54.961+03	t	2025-11-13 11:29:54.968643+03
21	1	$2b$10$PlQ5jFXrDu/rpoM97nqeeu36OYQ.5TOeTQxSsvRqgNXTjQonNJrzi	2025-11-14 15:18:08.681+03	f	2025-11-13 15:18:10.838387+03
22	1	$2b$10$HNEh6BBJHfmadhJg4bhjleRvXvPHefCAUfKCwtKbG7YxUforar/Zu	2025-11-16 16:26:59.255+03	t	2025-11-15 16:26:59.30463+03
23	1	$2b$10$WSNHNLvN8Hj9H8yM6RYEUOuFb5QS9CYK2txoxrR8CCW9apQTDVD8e	2025-11-16 16:43:45.697+03	t	2025-11-15 16:43:45.830183+03
24	1	$2b$10$HIO1feQalDqus8NCEGMsvugwI.3ag4F5iV3IGjUE5A5j4hy8DGlNe	2025-11-16 16:59:47.384+03	t	2025-11-15 16:59:47.493901+03
25	1	$2b$10$Xd7D.UqVnGd0tCCufagiFu/kt/Uwd6XG75flqvi0FKs8ZLHI9z89i	2025-11-16 17:19:37.547+03	t	2025-11-15 17:19:37.679504+03
26	1	$2b$10$LrU0yRHSPSlt75x667auCuu2rUbj5RneNHU0v2QaC8zx9yDCUs2ua	2025-11-16 17:35:25.898+03	t	2025-11-15 17:35:25.901591+03
27	1	$2b$10$nmBrg3fGEWmThvrMrPaqYO8mwtsS1L2rWudXZf0JxNU6laTECOX8a	2025-11-16 17:35:26.396+03	t	2025-11-15 17:35:26.424904+03
28	1	$2b$10$WIzQfs8aa7FI8fkNeWXoxugnVvQZMSfv1qEPjEPvg07xQ8Oly4NvW	2025-11-16 18:26:56.896+03	t	2025-11-15 18:26:56.901869+03
29	1	$2b$10$MDbkgQufFXjHlH7zjfFKIexozpSZC4fjV6p8hcbcjV7/jDoJvx1VO	2025-11-16 18:42:09.469+03	t	2025-11-15 18:42:09.623683+03
30	1	$2b$10$yvRFfUS5W3fjetiWuuNoQuVdq617jnKoo0dGMmD0bAfFAbMHS9gnq	2025-11-16 19:06:41.578+03	t	2025-11-15 19:06:41.882547+03
31	1	$2b$10$PMAoSV/KynuOrFM8Z/TC1ehuh0W386a7ywPmT7SCb7fJIIAyxTDSW	2025-11-16 19:28:45.408+03	t	2025-11-15 19:28:45.548915+03
32	1	$2b$10$v/YmwTV5u35jyQy34MLLwe1Tep.IvfjAgQD58oJaSZvs3Mar0gHV.	2025-11-16 19:45:39.513+03	t	2025-11-15 19:45:39.674121+03
33	1	$2b$10$CecE1HXj0I0uJtLIcLgFT.Z6BKJuI8FZcd460gRsT9aU/G51vr6Ge	2025-11-16 20:27:55.863+03	t	2025-11-15 20:27:56.1858+03
34	1	$2b$10$Zhdpg/PQpzhE/RquRHVtHuCQtTgBoY3rL.qlvSyKKbpCwQRkHO/uy	2025-11-16 20:50:02.251+03	t	2025-11-15 20:50:02.331021+03
35	1	$2b$10$ygN5BqWqJ5wNklCK19R4.OSb15V.wKtagFcBkZV1CNJSuZFLj.2DG	2025-11-16 22:27:47.127+03	t	2025-11-15 22:27:47.250627+03
36	1	$2b$10$k3RyUPX5QVcJ7E2U0JpYMu6oJdq0xbOCqniBEQd29N2Ce0YEmatuy	2025-11-16 22:46:30.91+03	t	2025-11-15 22:46:30.990706+03
37	1	$2b$10$sSy6tQbRi43eeej8tMAwHOanvLBQezYVsoUrI7cwXa9qR6Dfb136y	2025-11-16 23:01:45.063+03	t	2025-11-15 23:01:45.192467+03
38	1	$2b$10$EfaF7fD/ceJlyZB13TLysO38Tue4tmS/XflaXfGVi6veIjNOnfbG6	2025-11-16 23:17:10.714+03	t	2025-11-15 23:17:10.836251+03
39	1	$2b$10$OtYHzkxASD.pm8.7y9JaFeBehYmeILkI2Zu4KQT/n27RO019.S16O	2025-11-16 23:32:10.26+03	t	2025-11-15 23:32:10.272002+03
40	1	$2b$10$39wxZrdKWuV4jMrI..l3bu79p3J7vaFvRhrl60063fIIVJYHga4km	2025-11-16 23:47:27.554+03	t	2025-11-15 23:47:27.682093+03
41	1	$2b$10$ZC1K2LhOlHdyreEDdStXzepUx4yEtF7GDBiqKPCgu0.uSns3PoDta	2025-11-17 00:03:30.836+03	t	2025-11-16 00:03:30.955976+03
42	1	$2b$10$slecyiC0JZ4vv3/aDPZpAeh4dZ85QILPu2YVv5L0w2GSGrPmBLmCu	2025-11-17 00:25:31.65+03	t	2025-11-16 00:25:31.770109+03
43	1	$2b$10$Fys9Gz8eAAvaz6t853OqWeX57l.dRab9rsSXnzZ6chtqIIGCcZCoW	2025-11-17 00:41:36.427+03	t	2025-11-16 00:41:36.42994+03
44	1	$2b$10$hJOZGZzkLEda/DFRxXrllOamedVi7EYQL8rnePnrbZtCxnO8300am	2025-11-17 00:57:44.223+03	t	2025-11-16 00:57:44.32214+03
45	1	$2b$10$h/y3wB8cChkLnTtSuTFJXeWzavqEiTbvGZBFqxZ1syI12I6wE7o6i	2025-11-17 01:15:26.898+03	t	2025-11-16 01:15:27.032435+03
46	1	$2b$10$PjGfUf1rQBPc2WyiAuDKT.B7Cj1sQ4/4TUqiM4e0Z.0gmUa950hOC	2025-11-17 01:31:26.233+03	t	2025-11-16 01:31:26.568615+03
47	1	$2b$10$bXr6/bOOHtK5l6gJns1ZtOZlwhAvtsU93oVgAmklrHtnRkIOJtQYu	2025-11-17 01:47:27.119+03	t	2025-11-16 01:47:27.14009+03
48	1	$2b$10$0SC5i5OyI/gEfKyVYeC80.1wuNGTSMM5j8odJ0C9MtsIW8JHC4OJq	2025-11-17 02:10:32.698+03	t	2025-11-16 02:10:32.766038+03
49	1	$2b$10$nLAkSKfrP0gLt.7Vsk0JT.iKiOhCMYy4WbiWHGPjx9sCc5SSpB0Gq	2025-11-17 02:34:19.573+03	f	2025-11-16 02:34:19.586305+03
\.


--
-- Data for Name: Reports; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Reports" (id, "activityId", "userId", narrative, metrics_data, new_status, status, "adminComment", "resubmissionDeadline", applied, "appliedBy", "appliedAt", "createdAt", "updatedAt") FROM stdin;
1	5	1	\N	{"በቁጥር": ""}	\N	Pending	\N	\N	f	\N	\N	2025-11-15 22:40:44.366922+03	2025-11-15 22:40:44.366922+03
\.


--
-- Data for Name: RolePermissions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."RolePermissions" (id, "roleId", "permissionId", "createdAt", "updatedAt") FROM stdin;
1	1	1	2025-11-11 14:51:59.931902+03	2025-11-11 14:51:59.931902+03
2	1	2	2025-11-11 14:51:59.931902+03	2025-11-11 14:51:59.931902+03
3	1	3	2025-11-11 14:51:59.931902+03	2025-11-11 14:51:59.931902+03
4	1	4	2025-11-11 14:51:59.931902+03	2025-11-11 14:51:59.931902+03
5	1	5	2025-11-11 14:51:59.931902+03	2025-11-11 14:51:59.931902+03
6	1	6	2025-11-11 14:51:59.931902+03	2025-11-11 14:51:59.931902+03
7	1	7	2025-11-11 14:51:59.931902+03	2025-11-11 14:51:59.931902+03
8	1	8	2025-11-11 14:51:59.931902+03	2025-11-11 14:51:59.931902+03
9	1	9	2025-11-11 14:51:59.931902+03	2025-11-11 14:51:59.931902+03
10	1	10	2025-11-11 14:51:59.931902+03	2025-11-11 14:51:59.931902+03
11	1	11	2025-11-11 14:51:59.931902+03	2025-11-11 14:51:59.931902+03
12	1	12	2025-11-11 14:51:59.931902+03	2025-11-11 14:51:59.931902+03
13	2	1	2025-11-11 14:51:59.931902+03	2025-11-11 14:51:59.931902+03
14	2	2	2025-11-11 14:51:59.931902+03	2025-11-11 14:51:59.931902+03
15	2	5	2025-11-11 14:51:59.931902+03	2025-11-11 14:51:59.931902+03
16	2	4	2025-11-11 14:51:59.931902+03	2025-11-11 14:51:59.931902+03
17	2	10	2025-11-11 14:51:59.931902+03	2025-11-11 14:51:59.931902+03
18	3	4	2025-11-11 14:51:59.931902+03	2025-11-11 14:51:59.931902+03
19	3	2	2025-11-11 14:51:59.931902+03	2025-11-11 14:51:59.931902+03
20	3	10	2025-11-11 14:51:59.931902+03	2025-11-11 14:51:59.931902+03
\.


--
-- Data for Name: Roles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Roles" (id, name, description, "createdAt", "updatedAt") FROM stdin;
1	Admin	Admin role	2025-11-11 14:51:59.931902+03	2025-11-11 14:51:59.931902+03
2	Manager	Manager role	2025-11-11 14:51:59.931902+03	2025-11-11 14:51:59.931902+03
3	User	User role	2025-11-11 14:51:59.931902+03	2025-11-11 14:51:59.931902+03
\.


--
-- Data for Name: SystemSettings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."SystemSettings" (key, value, description, "createdAt", "updatedAt") FROM stdin;
max_attachment_size_mb	10	Max attachment upload size (MB)	2025-11-11 14:51:59.931902+03	2025-11-11 14:51:59.931902+03
allowed_attachment_types	["application/pdf", "image/png", "image/jpeg", "text/plain"]	Allowed MIME types	2025-11-11 14:51:59.931902+03	2025-11-11 14:51:59.931902+03
reporting_active	true	Enable report submissions	2025-11-11 14:51:59.931902+03	2025-11-11 14:51:59.931902+03
audit_retention_days	365	Days to retain audit logs	2025-11-11 14:51:59.931902+03	2025-11-11 14:51:59.931902+03
\.


--
-- Data for Name: Tasks; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Tasks" (id, "goalId", "rollNo", title, description, status, "assigneeId", "dueDate", progress, weight, "createdAt", "updatedAt") FROM stdin;
41	11	4	የክልሉን የኮንስትራክሽን ጥራት ምርመራ አገልግሎት በማሳደግ	\N	To Do	\N	\N	0	2	2025-11-12 22:41:26.760682+03	2025-11-12 22:47:38.659512+03
6	6	1	የዕቅድ ዝግጅት፣ የክትትልና ግምገማ እና የስታቲስቲክስ መረጃ አስተዳደር አሰራር ማሻሻል	\N	To Do	\N	\N	0	2	2025-10-12 23:59:55.871457+03	2025-11-11 15:15:13.009333+03
13	6	8	የሴቶችና የአካል ጉዳተኞች ማሕበራዊ ተሳታፊነትንና ተጠቃሚነትን ማሳደግ	\N	To Do	\N	\N	0	1	2025-10-13 00:56:13.812381+03	2025-11-11 15:54:22.750709+03
11	6	6	ለተጠሪ ተቋማት እና ለወረዳዎች ድጋፍና ክትትል ማድረግ	\N	To Do	\N	\N	0	1	2025-10-13 00:44:11.544165+03	2025-11-12 23:11:21.199801+03
7	6	2	የሰው ሀብት ልማት እና አስተዳደር አሰራርና ውጤታማነት ማሳደግ	\N	To Do	\N	\N	0	2	2025-10-13 00:22:57.303025+03	2025-11-11 15:27:50.514102+03
8	6	3	የፋይናንስና ንብረት አስተዳደር አሰራርንና ውጤታማነትን ማሳደግ	\N	To Do	\N	\N	0	3	2025-10-13 00:27:31.525559+03	2025-11-11 15:39:46.862191+03
9	6	4	የኢንፎርሜሽን፣ኮሙኒኬሽን እና ቴክኖልጂ አሰራርንና ውጤታማነትን ማሳደግ	\N	To Do	\N	\N	0	1	2025-10-13 00:39:19.649064+03	2025-11-11 15:43:13.864977+03
10	6	5	የአጋርነት እና የህዝብ ግንኙነት አሰራርንና ውጤታማነትን ማሳደግ	\N	To Do	\N	\N	0	1	2025-10-13 00:41:50.301228+03	2025-11-11 15:45:33.589642+03
12	6	7	የስነ ምግባርና ፀረ ሙስና የክትትል ሥራዎችን ማጠናከር	\N	To Do	\N	\N	0	1.5	2025-10-13 00:48:56.182669+03	2025-11-11 15:52:14.052802+03
17	7	3	የከተማ ፕላን ትግበራ ክትትልና ቁጥጥር ማሳደግ	\N	To Do	\N	\N	0	5	2025-10-13 06:19:22.246774+03	2025-11-11 16:30:54.266223+03
18	7	4	ለገጠር ልማት ማዕከላት የተዘጋጁ ስኬች ፕላኖችን ማስተግበር	\N	To Do	\N	\N	0	1.25	2025-10-13 06:23:44.627089+03	2025-11-11 16:34:41.26052+03
19	7	5	የከተማ ፕላን ክዋኔ ኦዲት ጥራትና ሽፋን ማሳደግ	\N	To Do	\N	\N	0	2.5	2025-10-13 06:25:48.767478+03	2025-11-11 16:35:58.112345+03
20	8	1	ለተለያዩ አገልግሎቶች የሚዉል መሬት ማዘጋጀት	\N	To Do	\N	\N	0	2.25	2025-10-13 06:27:30.745393+03	2025-11-11 16:39:27.52496+03
14	6	9	የበጎ አድራጎት እና የማህበረሰብ አገልግሎት ሥራዎችን ማሳደግ	\N	To Do	\N	\N	0	2.5	2025-10-13 05:42:46.995781+03	2025-11-11 16:09:02.814799+03
21	8	2	ለተለያዩ አገልግሎቶች መሬት ማስተላለፍ	\N	To Do	\N	\N	0	6.75	2025-10-13 06:30:49.012725+03	2025-11-11 16:47:02.278264+03
15	7	1	የፕላን ዝግጅት ጥራትና ሽፋን ማሳደግ	\N	To Do	\N	\N	0	6	2025-10-13 06:11:05.285309+03	2025-11-11 16:21:18.368909+03
22	8	3	ይዞታን መመስረት	\N	To Do	\N	\N	0	1.5	2025-10-13 06:35:07.271133+03	2025-11-11 16:56:51.311083+03
16	7	2	የከተማ ፕላን ጥናትና ምርምር ና ስልጠና ስራዎች	\N	To Do	\N	\N	0	2.25	2025-10-13 06:16:39.469035+03	2025-11-11 16:25:46.208803+03
23	8	4	ከመሬትና ከመሬት ነክ ቋሚ ንብረት የሚሰበሰብ ገቢን ማሳደግ	\N	To Do	\N	\N	0	3	2025-10-13 06:39:39.214343+03	2025-11-11 17:00:14.068669+03
29	9	5	በከተሞች ለንብረት ግመታ የከተማ ቦታ ደረጃ እንዲሻሻል ስራ ይሰራል፡፡	\N	To Do	\N	\N	0	2	2025-10-13 06:58:12.837801+03	2025-11-12 21:37:56.347325+03
24	8	5	የይዞታ ማህደራትን ማደራጀት፣ መጠበቅና ለተገልጋይ ተደራሽ ማድረግ	\N	To Do	\N	\N	0	1.5	2025-10-13 06:42:10.444696+03	2025-11-11 17:03:23.642741+03
30	10	1	የሕንፃ ሕግጋትና የከተማ ፕላንን መሠረት ያደረገ የግንባታ ፍቃድ አሰጣጥን ማሳደግ	\N	To Do	\N	\N	0	4	2025-10-13 07:03:46.184965+03	2025-11-12 21:41:50.844394+03
25	9	1	ለይዞታ ማረጋገጥና ምዘገባ ስራ ቅድመ ስራዎችን ማጠናቀቅ	\N	To Do	\N	\N	0	3	2025-10-13 06:44:22.646086+03	2025-11-11 17:09:24.441338+03
31	10	2	በዘመናዊ ቴክኖሎጂ የተደራጀ የመረጃ፤የሕግ እና የአሰራርን ማሳደግ	\N	To Do	\N	\N	0	3	2025-10-13 07:07:01.851273+03	2025-11-12 21:44:39.083322+03
32	10	3	የውጭ ማስታወቂያ ፍቃድ አገልግሎትን ማሻሻል	\N	To Do	\N	\N	0	1.5	2025-10-13 07:12:27.116532+03	2025-11-12 21:45:28.016368+03
26	9	2	በተመረጡ ሰፈሮች ውስጥ ይዞታዎችን የማረጋገጥ ስራ ይሰራል	\N	To Do	\N	\N	0	4	2025-10-13 06:48:55.509244+03	2025-11-11 17:15:44.497132+03
27	9	3	በተመረጡ ሰፈሮች ውስጥ የሚገኙ መሬት ይዞታችን የምዝገባ ስራ ይሰራል	\N	To Do	\N	\N	0	2	2025-10-13 06:53:16.714058+03	2025-11-11 17:18:27.120668+03
28	9	4	የመሬት ይዞታ ማረጋገጥና ምዝገባ አገልግሎት የመስጠት ስራ ይሰራል፡፡	\N	To Do	\N	\N	0	2	2025-10-13 06:55:35.708577+03	2025-11-11 17:22:03.386055+03
33	10	4	የግንባታ ክትትልና ቁጥጥር ሥራ በማከናወን ጥራትና ደህንነትን ማረጋገጥ	\N	To Do	\N	\N	0	4	2025-10-13 07:13:48.722051+03	2025-11-12 21:48:33.587047+03
34	10	5	የመረጃ እና የሕግ አሰራርን ማሳደግ	\N	To Do	\N	\N	0	1.5	2025-10-13 07:19:59.243853+03	2025-11-12 21:49:23.992872+03
35	10	6	በዘመናዊ ቴክኖሎጂ የተደራጀ አሰራርን ማሳደግ	\N	To Do	\N	\N	0	1	2025-10-13 07:21:14.174914+03	2025-11-12 21:50:25.180837+03
36	11	1	የቤቶች ልማትና አስተዳደር ስራዎችን ማሻሻል	\N	To Do	\N	\N	0	4.5	2025-10-13 07:23:01.627278+03	2025-11-12 22:22:47.298696+03
37	11	2	የዲዛይንና ዝግጅትን በጥራትና በወቅቱ ማከናወን	\N	To Do	\N	\N	0	2.5	2025-10-13 08:54:52.844328+03	2025-11-12 22:26:59.690669+03
38	11	3	የግንባታ ጨረታና ዉለታ አስተዳደርን ማሻሻል	\N	To Do	\N	\N	0	6	2025-10-13 08:58:35.87468+03	2025-11-12 22:40:48.767483+03
39	12	1	የመንግስት ቤቶችን ማስተዳደር	\N	To Do	\N	\N	0	7	2025-10-27 06:50:18.231339+03	2025-11-12 22:57:02.394028+03
40	12	2	የመንግስት ቤቶችን ማደስ፤ ማልማት እና የቤቶች የይዞታ ማረጋገጫ እንዲኖራቸው ማድረግ	\N	To Do	\N	\N	0	3	2025-10-27 06:53:40.874536+03	2025-11-12 23:00:32.740988+03
\.


--
-- Data for Name: UserGroups; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."UserGroups" (id, "userId", "groupId", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Users" (id, username, name, "profilePicture", password, "roleId", language, token_version, "createdAt", "updatedAt") FROM stdin;
1	admin	System Admin	/uploads/admin.png	$2b$10$FGEy/sdSrPGJTekiFPs61ehYQuHSk0PntZ/yPuLOotpmuKi1hwLjy	1	en	0	2025-11-11 14:51:59.931902+03	2025-11-11 14:51:59.931902+03
\.


--
-- Name: Activities_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Activities_id_seq"', 211, true);


--
-- Name: Activities_rollNo_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Activities_rollNo_seq"', 23, true);


--
-- Name: Attachments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Attachments_id_seq"', 1, true);


--
-- Name: AuditLogs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."AuditLogs_id_seq"', 243, true);


--
-- Name: Goals_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Goals_id_seq"', 12, true);


--
-- Name: Goals_rollNo_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Goals_rollNo_seq"', 7, true);


--
-- Name: Groups_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Groups_id_seq"', 1, true);


--
-- Name: Notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Notifications_id_seq"', 236, true);


--
-- Name: Permissions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Permissions_id_seq"', 12, true);


--
-- Name: ProgressHistory_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."ProgressHistory_id_seq"', 200, true);


--
-- Name: RefreshTokens_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."RefreshTokens_id_seq"', 49, true);


--
-- Name: Reports_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Reports_id_seq"', 1, true);


--
-- Name: RolePermissions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."RolePermissions_id_seq"', 35, true);


--
-- Name: Roles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Roles_id_seq"', 5, true);


--
-- Name: Tasks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Tasks_id_seq"', 41, true);


--
-- Name: Tasks_rollNo_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Tasks_rollNo_seq"', 10, true);


--
-- Name: UserGroups_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."UserGroups_id_seq"', 2, true);


--
-- Name: Users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Users_id_seq"', 4, true);


--
-- Name: goals_rollno_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.goals_rollno_seq', 1, false);


--
-- Name: Activities Activities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Activities"
    ADD CONSTRAINT "Activities_pkey" PRIMARY KEY (id);


--
-- Name: Attachments Attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Attachments"
    ADD CONSTRAINT "Attachments_pkey" PRIMARY KEY (id);


--
-- Name: AuditLogs AuditLogs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AuditLogs"
    ADD CONSTRAINT "AuditLogs_pkey" PRIMARY KEY (id);


--
-- Name: Goals Goals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Goals"
    ADD CONSTRAINT "Goals_pkey" PRIMARY KEY (id);


--
-- Name: Groups Groups_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Groups"
    ADD CONSTRAINT "Groups_name_key" UNIQUE (name);


--
-- Name: Groups Groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Groups"
    ADD CONSTRAINT "Groups_pkey" PRIMARY KEY (id);


--
-- Name: Notifications Notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Notifications"
    ADD CONSTRAINT "Notifications_pkey" PRIMARY KEY (id);


--
-- Name: Permissions Permissions_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Permissions"
    ADD CONSTRAINT "Permissions_name_key" UNIQUE (name);


--
-- Name: Permissions Permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Permissions"
    ADD CONSTRAINT "Permissions_pkey" PRIMARY KEY (id);


--
-- Name: ProgressHistory ProgressHistory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProgressHistory"
    ADD CONSTRAINT "ProgressHistory_pkey" PRIMARY KEY (id);


--
-- Name: RefreshTokens RefreshTokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RefreshTokens"
    ADD CONSTRAINT "RefreshTokens_pkey" PRIMARY KEY (id);


--
-- Name: Reports Reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Reports"
    ADD CONSTRAINT "Reports_pkey" PRIMARY KEY (id);


--
-- Name: RolePermissions RolePermissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RolePermissions"
    ADD CONSTRAINT "RolePermissions_pkey" PRIMARY KEY (id);


--
-- Name: RolePermissions RolePermissions_roleId_permissionId_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RolePermissions"
    ADD CONSTRAINT "RolePermissions_roleId_permissionId_key" UNIQUE ("roleId", "permissionId");


--
-- Name: Roles Roles_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Roles"
    ADD CONSTRAINT "Roles_name_key" UNIQUE (name);


--
-- Name: Roles Roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Roles"
    ADD CONSTRAINT "Roles_pkey" PRIMARY KEY (id);


--
-- Name: SystemSettings SystemSettings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SystemSettings"
    ADD CONSTRAINT "SystemSettings_pkey" PRIMARY KEY (key);


--
-- Name: Tasks Tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Tasks"
    ADD CONSTRAINT "Tasks_pkey" PRIMARY KEY (id);


--
-- Name: UserGroups UserGroups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserGroups"
    ADD CONSTRAINT "UserGroups_pkey" PRIMARY KEY (id);


--
-- Name: UserGroups UserGroups_userId_groupId_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserGroups"
    ADD CONSTRAINT "UserGroups_userId_groupId_key" UNIQUE ("userId", "groupId");


--
-- Name: Users Users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Users"
    ADD CONSTRAINT "Users_pkey" PRIMARY KEY (id);


--
-- Name: Users Users_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Users"
    ADD CONSTRAINT "Users_username_key" UNIQUE (username);


--
-- Name: idx_activities_parent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activities_parent_id ON public."Activities" USING btree ("parentId");


--
-- Name: idx_activities_task_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activities_task_id ON public."Activities" USING btree ("taskId");


--
-- Name: idx_attachments_reportid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attachments_reportid ON public."Attachments" USING btree ("reportId");


--
-- Name: idx_auditlogs_createdat; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auditlogs_createdat ON public."AuditLogs" USING btree ("createdAt");


--
-- Name: idx_goals_group_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_goals_group_status ON public."Goals" USING btree ("groupId", status);


--
-- Name: idx_notifications_userid_createdat; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_userid_createdat ON public."Notifications" USING btree ("userId", "createdAt");


--
-- Name: idx_progresshistory_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_progresshistory_entity ON public."ProgressHistory" USING btree (entity_type, entity_id);


--
-- Name: idx_progresshistory_recorded_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_progresshistory_recorded_at ON public."ProgressHistory" USING btree (recorded_at);


--
-- Name: idx_progresshistory_snapshot_month; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_progresshistory_snapshot_month ON public."ProgressHistory" USING btree (snapshot_month);


--
-- Name: idx_refresh_tokens_userid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refresh_tokens_userid ON public."RefreshTokens" USING btree ("userId");


--
-- Name: idx_reports_activityid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reports_activityid ON public."Reports" USING btree ("activityId");


--
-- Name: idx_reports_applied; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reports_applied ON public."Reports" USING btree (applied);


--
-- Name: idx_reports_userid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reports_userid ON public."Reports" USING btree ("userId");


--
-- Name: idx_tasks_assignee_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_assignee_id ON public."Tasks" USING btree ("assigneeId");


--
-- Name: idx_tasks_goal_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_goal_id ON public."Tasks" USING btree ("goalId");


--
-- Name: ux_activities_task_roll; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_activities_task_roll ON public."Activities" USING btree ("taskId", "rollNo");


--
-- Name: ux_goals_rollno; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_goals_rollno ON public."Goals" USING btree ("rollNo");


--
-- Name: ux_progresshistory_entity_month; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_progresshistory_entity_month ON public."ProgressHistory" USING btree (entity_type, entity_id, snapshot_month);


--
-- Name: ux_tasks_goal_roll; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_tasks_goal_roll ON public."Tasks" USING btree ("goalId", "rollNo");


--
-- Name: Activities after_activities_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER after_activities_change AFTER INSERT OR DELETE OR UPDATE ON public."Activities" FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_task_progress();


--
-- Name: Tasks after_tasks_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER after_tasks_change AFTER INSERT OR DELETE OR UPDATE ON public."Tasks" FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_goal_progress();


--
-- Name: Activities before_activities_insert_assign_rollno; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER before_activities_insert_assign_rollno BEFORE INSERT ON public."Activities" FOR EACH ROW EXECUTE FUNCTION public.trg_assign_activity_rollno();


--
-- Name: Tasks before_tasks_insert_assign_rollno; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER before_tasks_insert_assign_rollno BEFORE INSERT ON public."Tasks" FOR EACH ROW EXECUTE FUNCTION public.trg_assign_task_rollno();


--
-- Name: Activities set_updatedat_activities; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updatedat_activities BEFORE UPDATE ON public."Activities" FOR EACH ROW EXECUTE FUNCTION public.update_updatedat_column();


--
-- Name: Goals set_updatedat_goals; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updatedat_goals BEFORE UPDATE ON public."Goals" FOR EACH ROW EXECUTE FUNCTION public.update_updatedat_column();


--
-- Name: Groups set_updatedat_groups; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updatedat_groups BEFORE UPDATE ON public."Groups" FOR EACH ROW EXECUTE FUNCTION public.update_updatedat_column();


--
-- Name: Permissions set_updatedat_permissions; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updatedat_permissions BEFORE UPDATE ON public."Permissions" FOR EACH ROW EXECUTE FUNCTION public.update_updatedat_column();


--
-- Name: Reports set_updatedat_reports; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updatedat_reports BEFORE UPDATE ON public."Reports" FOR EACH ROW EXECUTE FUNCTION public.update_updatedat_column();


--
-- Name: RolePermissions set_updatedat_rolepermissions; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updatedat_rolepermissions BEFORE UPDATE ON public."RolePermissions" FOR EACH ROW EXECUTE FUNCTION public.update_updatedat_column();


--
-- Name: Roles set_updatedat_roles; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updatedat_roles BEFORE UPDATE ON public."Roles" FOR EACH ROW EXECUTE FUNCTION public.update_updatedat_column();


--
-- Name: SystemSettings set_updatedat_systemsettings; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updatedat_systemsettings BEFORE UPDATE ON public."SystemSettings" FOR EACH ROW EXECUTE FUNCTION public.update_updatedat_column();


--
-- Name: Tasks set_updatedat_tasks; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updatedat_tasks BEFORE UPDATE ON public."Tasks" FOR EACH ROW EXECUTE FUNCTION public.update_updatedat_column();


--
-- Name: UserGroups set_updatedat_usergroups; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updatedat_usergroups BEFORE UPDATE ON public."UserGroups" FOR EACH ROW EXECUTE FUNCTION public.update_updatedat_column();


--
-- Name: Users set_updatedat_users; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updatedat_users BEFORE UPDATE ON public."Users" FOR EACH ROW EXECUTE FUNCTION public.update_updatedat_column();


--
-- Name: Activities Activities_parentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Activities"
    ADD CONSTRAINT "Activities_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES public."Activities"(id) ON DELETE CASCADE;


--
-- Name: Activities Activities_taskId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Activities"
    ADD CONSTRAINT "Activities_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES public."Tasks"(id) ON DELETE CASCADE;


--
-- Name: Attachments Attachments_reportId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Attachments"
    ADD CONSTRAINT "Attachments_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES public."Reports"(id) ON DELETE CASCADE;


--
-- Name: AuditLogs AuditLogs_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AuditLogs"
    ADD CONSTRAINT "AuditLogs_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."Users"(id) ON DELETE SET NULL;


--
-- Name: Goals Goals_groupId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Goals"
    ADD CONSTRAINT "Goals_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES public."Groups"(id) ON DELETE SET NULL;


--
-- Name: Notifications Notifications_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Notifications"
    ADD CONSTRAINT "Notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."Users"(id) ON DELETE CASCADE;


--
-- Name: RefreshTokens RefreshTokens_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RefreshTokens"
    ADD CONSTRAINT "RefreshTokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."Users"(id) ON DELETE CASCADE;


--
-- Name: Reports Reports_activityId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Reports"
    ADD CONSTRAINT "Reports_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES public."Activities"(id) ON DELETE CASCADE;


--
-- Name: Reports Reports_appliedBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Reports"
    ADD CONSTRAINT "Reports_appliedBy_fkey" FOREIGN KEY ("appliedBy") REFERENCES public."Users"(id) ON DELETE SET NULL;


--
-- Name: Reports Reports_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Reports"
    ADD CONSTRAINT "Reports_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."Users"(id) ON DELETE SET NULL;


--
-- Name: RolePermissions RolePermissions_permissionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RolePermissions"
    ADD CONSTRAINT "RolePermissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES public."Permissions"(id) ON DELETE CASCADE;


--
-- Name: RolePermissions RolePermissions_roleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RolePermissions"
    ADD CONSTRAINT "RolePermissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES public."Roles"(id) ON DELETE CASCADE;


--
-- Name: Tasks Tasks_assigneeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Tasks"
    ADD CONSTRAINT "Tasks_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES public."Users"(id) ON DELETE SET NULL;


--
-- Name: Tasks Tasks_goalId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Tasks"
    ADD CONSTRAINT "Tasks_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES public."Goals"(id) ON DELETE CASCADE;


--
-- Name: UserGroups UserGroups_groupId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserGroups"
    ADD CONSTRAINT "UserGroups_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES public."Groups"(id) ON DELETE CASCADE;


--
-- Name: UserGroups UserGroups_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserGroups"
    ADD CONSTRAINT "UserGroups_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."Users"(id) ON DELETE CASCADE;


--
-- Name: Users Users_roleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Users"
    ADD CONSTRAINT "Users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES public."Roles"(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict qAgu3JNu6sI0pNFY9ltRfByOXbFD6xevToBoEkbFzbOy22E9N9UznCC7cTJsbed

