-- Adds the Defying Grief program tag to an ALREADY-LIVE conversations table.
-- schema.sql's `create table if not exists` won't retrofit existing tables,
-- so run this once against the live database (Supabase SQL editor), after
-- 0001_membership_status.sql. Safe to re-run: the whole clause is skipped if
-- the column exists.

alter table public.conversations
  add column if not exists program text not null default 'general'
    check (program in ('general', 'defying-grief'));
