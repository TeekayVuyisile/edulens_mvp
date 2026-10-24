-- Edulens is a South African product: dates such as "enrolled today" and
-- assessment days follow South African time. Local development and CI already
-- run Postgres on Africa/Johannesburg; hosted databases (Neon) default to UTC.
-- Applies to new connections. Skipped (with a notice) where the role may not
-- alter the database. Safe to re-run.

DO $$
BEGIN
  EXECUTE format('ALTER DATABASE %I SET timezone TO %L', current_database(), 'Africa/Johannesburg');
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'Could not set the database time zone (not the owner); set it to Africa/Johannesburg manually.';
END $$;
