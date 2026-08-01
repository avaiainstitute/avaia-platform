-- Adds the membership paywall's membership_status column to an ALREADY-LIVE
-- profiles table. schema.sql's `create table if not exists` won't retrofit
-- existing tables, so run this once against the live database (Supabase SQL
-- editor). Safe to re-run: the whole clause is skipped if the column exists.

alter table public.profiles
  add column if not exists membership_status text not null default 'free'
    check (membership_status in ('free', 'member'));
