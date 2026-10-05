-- 0119_pink_inquiry_status_columns.sql
--
-- Pink Shoelace Foundation stabilization (2026-10-05). Two verified defects in the existing
-- Foundation inquiry records:
--
--  1. The admin "mark acknowledged / resolved" action (lib/admin-views/InquiriesView.tsx) writes
--     resolved_at, but pink_contact_submissions and pink_participation_interest never had that
--     column (only AVAIA's contact_submissions does), so the update failed for every Foundation
--     inquiry and a flagged item would repeat in the daily summary forever.
--  2. Nothing ever recorded that an acknowledgment email actually went out. acknowledged_at is
--     set by the intake route only after the email is sent.
--
-- Purely additive and safe to run more than once. Both tables are service-role only (RLS enabled,
-- no policies) and stay that way.

alter table public.pink_contact_submissions
  add column if not exists resolved_at     timestamptz,
  add column if not exists acknowledged_at timestamptz;

alter table public.pink_participation_interest
  add column if not exists resolved_at     timestamptz,
  add column if not exists acknowledged_at timestamptz;

-- Verification (read-only).
select
  (select count(*) from information_schema.columns where table_name = 'pink_contact_submissions' and column_name in ('resolved_at', 'acknowledged_at')) as contact_columns_must_be_2,
  (select count(*) from information_schema.columns where table_name = 'pink_participation_interest' and column_name in ('resolved_at', 'acknowledged_at')) as participation_columns_must_be_2;
