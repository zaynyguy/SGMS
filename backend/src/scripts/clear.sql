-- This script clears the database by dropping all user-defined objects
DO $$
DECLARE
  r RECORD;
BEGIN
  -- 1. Drop all triggers
  FOR r IN
    SELECT tgname, tgrelid::regclass AS table_name
    FROM pg_trigger
    WHERE NOT tgisinternal
  LOOP
    EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(r.tgname) || ' ON ' || r.table_name || ' CASCADE';
  END LOOP;

  -- 2. Drop all functions and procedures
  FOR r IN
    SELECT oid::regprocedure AS func
    FROM pg_proc
    WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func || ' CASCADE';
  END LOOP;

  -- 3. Drop all views
  FOR r IN
    SELECT viewname
    FROM pg_views
    WHERE schemaname = 'public'
  LOOP
    EXECUTE 'DROP VIEW IF EXISTS ' || quote_ident(r.viewname) || ' CASCADE';
  END LOOP;

  -- 4. Drop all tables (CASCADE removes FK constraints, indexes, etc.)
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
  END LOOP;

  -- 5. Drop all sequences
  FOR r IN
    SELECT sequence_name
    FROM information_schema.sequences
    WHERE sequence_schema = 'public'
  LOOP
    EXECUTE 'DROP SEQUENCE IF EXISTS ' || quote_ident(r.sequence_name) || ' CASCADE';
  END LOOP;

  -- 6. Drop all custom types (ENUMs, etc.)
  FOR r IN
    SELECT typname
    FROM pg_type t
    JOIN pg_namespace ns ON ns.oid = t.typnamespace
    WHERE t.typtype = 'e'  -- enum types only
      AND ns.nspname = 'public'
  LOOP
    EXECUTE 'DROP TYPE IF EXISTS ' || quote_ident(r.typname) || ' CASCADE';
  END LOOP;

  -- Optional: Clean up remaining extensions (only if you're sure)
  -- DROP EXTENSION IF EXISTS "uuid-ossp", "pgcrypto", "citext" CASCADE;

END $$;